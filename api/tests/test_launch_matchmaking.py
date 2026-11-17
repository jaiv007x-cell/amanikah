"""Launch-gated introduction consent and parallel SQLite access tests.

All accounts are synthetic and all databases are isolated temporary files.
"""
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import Store, Mailer
from private_features import PrivateFeatures


class MatchConsent(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.conf = {
            "MATCHMAKING_LIVE": "1",
            "VOICE_PRIVATE_DIR": str(Path(self.tmp.name)/"voices"),
            "WAITLIST_MODE": "1",
        }
        self.store = Store(str(Path(self.tmp.name)/"private.sqlite"), "test-pepper", Mailer(self.conf), self.conf)
        self.store.private_features = PrivateFeatures(self.store)
        self.a = self._member("first@example.test")
        self.b = self._member("second@example.test")
        self.outsider = self._member("outsider@example.test")

    def tearDown(self):
        self.store.close_thread_connection()
        self.tmp.cleanup()

    def _member(self, email):
        status, value = self.store.register_member({
            "email":email,"password":"test-password-long-1",
            "displayName":"Synthetic Adult", "age":30,
            "consentTerms":True,"consentPrivacy":True,
            "city":"Hyderabad","jurisdiction":"India"
        })
        self.assertEqual(status,201,value)
        mid = value["memberId"]
        self.store.conn.execute("UPDATE members SET email_verified=1 WHERE id=?", (mid,))
        self.store.conn.commit()
        return mid

    def _pair_case(self):
        status, body=self.store.ops_create_case({
            "memberId":self.a,"peerMemberId":self.b,"peerLabel":"Do not disclose"
        })
        self.assertEqual(status,201,body)
        self.assertEqual(body["case"]["status"],"draft")
        return body["case"]["id"]

    def test_two_adults_required_before_mutual(self):
        case_id=self._pair_case()
        self.assertEqual(self.store.ops_set_case_status(case_id,"mutual")[0],409)
        self.assertEqual(self.store.list_member_introductions(self.a)[1]["introductions"],[])
        self.assertEqual(self.store.ops_set_case_status(case_id,"open")[0],200)
        records=self.store.list_member_introductions(self.a)[1]["introductions"]
        self.assertEqual(len(records),1)
        self.assertNotIn("peerMemberId",str(records))
        self.assertNotIn(self.b,str(records))
        self.assertEqual(self.store.list_member_introductions(self.outsider)[1]["introductions"],[])
        self.assertEqual(self.store.respond_member_introduction(self.outsider,case_id,{"decision":"accept"})[0],404)
        self.assertEqual(self.store.ops_set_case_status(case_id,"mutual")[1]["code"],"BOTH_ADULTS_MUST_ACCEPT")
        self.assertEqual(self.store.respond_member_introduction(self.a,case_id,{"decision":"accept"})[0],200)
        self.assertEqual(self.store.ops_set_case_status(case_id,"mutual")[0],409)
        self.assertEqual(self.store.respond_member_introduction(self.b,case_id,{"decision":"accept"})[0],200)
        self.assertEqual(self.store.ops_set_case_status(case_id,"mutual")[0],200)
        self.assertEqual(self.store.list_member_introductions(self.a)[1]["introductions"][0]["status"],"mutual")

    def test_decline_revocation_and_closed_cannot_reopen(self):
        case_id=self._pair_case()
        self.store.ops_set_case_status(case_id,"open")
        self.store.respond_member_introduction(self.a,case_id,{"decision":"accept"})
        status, result=self.store.respond_member_introduction(self.b,case_id,{"decision":"decline"})
        self.assertEqual((status,result["status"]),(200,"paused"))
        self.assertEqual(self.store.ops_set_case_status(case_id,"mutual")[0],409)
        self.assertEqual(self.store.ops_set_case_status(case_id,"open")[0],409)
        self.assertEqual(self.store.respond_member_introduction(self.a,case_id,{"decision":"accept"})[0],409)
        self.assertEqual(self.store.ops_set_case_status(case_id,"closed")[0],200)
        self.assertEqual(self.store.ops_set_case_status(case_id,"draft")[0],409)

    def test_consent_withdrawal_and_block_defeat_existing_mutual(self):
        case_id=self._pair_case()
        self.store.ops_set_case_status(case_id,"open")
        self.store.respond_member_introduction(self.a,case_id,{"decision":"accept"})
        self.store.respond_member_introduction(self.b,case_id,{"decision":"accept"})
        self.store.ops_set_case_status(case_id,"mutual")
        self.assertEqual(self.store.withdraw_consent(self.a)[0],200)
        self.assertEqual(self.store.conn.execute(
            "SELECT status FROM introduction_cases WHERE id=?",(case_id,)).fetchone()[0],"paused")
        self.assertIsNone(self.store.conn.execute(
            "SELECT member_id FROM introduction_consents WHERE case_id=?",(case_id,)).fetchone())
        self.assertEqual(self.store.list_member_introductions(self.a)[0],403)
        self.assertEqual(self.store.ops_set_case_status(case_id,"mutual")[0],403)
        cid2=self._new_case_after_deleted_owner()
        self.assertEqual(self.store.ops_set_case_status(cid2,"open")[1]["code"],"TWO_VERIFIED_ADULTS_REQUIRED")

    def _new_case_after_deleted_owner(self):
        # Drafts can be created as administrative records but never made live
        # after participant eligibility is withdrawn.
        status, result = self.store.ops_create_case({"peerLabel":"Unpaired lead"})
        self.assertEqual(status,201)
        return result["case"]["id"]

    def test_bad_pair_is_rejected_without_storing(self):
        for details in [
            {"memberId":self.a},
            {"memberId":self.a,"peerMemberId":self.a},
            {"memberId":self.a,"peerMemberId":"nonexistent"},
        ]:
            status, response=self.store.ops_create_case(details)
            self.assertIn(status,(400,403),response)
        self.store.private_features.block(self.a,{"memberId":self.b})
        self.assertEqual(self.store.ops_create_case({
            "memberId":self.a, "peerMemberId":self.b})[0],403)

    def test_concurrent_separate_sqlite_connections_avoid_shared_transaction(self):
        errors = []
        def write_one(i):
            try:
                status, response=self.store.create_ticket({
                    "kind":"support","name":"Test Adult","email":f"ci{i}@example.test",
                    "topic":"Safe pilot inquiry",
                    "message":f"Long private test message for synthetic adult number {i}.",
                },f"198.51.100.{i}")
                return status
            except Exception as exc:
                errors.append(str(exc))
                return 500
            finally:
                self.store.close_thread_connection()
        with ThreadPoolExecutor(max_workers=6) as pool:
            results=list(pool.map(write_one,range(12)))
        self.assertFalse(errors,errors)
        self.assertEqual(results,[201]*12)
        count=self.store.conn.execute("SELECT COUNT(*) FROM tickets").fetchone()[0]
        self.assertEqual(count,12)


if __name__ == "__main__":
    unittest.main()
