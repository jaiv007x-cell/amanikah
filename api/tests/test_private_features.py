"""Privacy and functional regression tests for the member feature module."""
import io
import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from private_features import PrivateFeatures

class Stub:
    def __init__(self, folder):
        self.conn=sqlite3.connect(":memory:")
        self.conn.row_factory=sqlite3.Row
        self.conf={"VOICE_PRIVATE_DIR":folder}
        self.conn.executescript("""
          CREATE TABLE members(id TEXT PRIMARY KEY,email TEXT,email_verified INTEGER,is_demo INTEGER,deleted_at TEXT);
          CREATE TABLE consents(member_id TEXT PRIMARY KEY, withdrawn INTEGER);
          CREATE TABLE profiles(member_id TEXT PRIMARY KEY,city TEXT,intentions TEXT);
        """)
        for ident,email in [("adult","a@example.test"),("mother","m@example.test"),("stranger","s@example.test")]:
            self.conn.execute("INSERT INTO members VALUES(?,?,1,0,NULL)",(ident,email))
            self.conn.execute("INSERT INTO consents VALUES(?,0)",(ident,))
            self.conn.execute("INSERT INTO profiles VALUES(?,?,?)",(ident,"Hyderabad","A private marriage intention"))
        self.conn.commit()
    def audit(self,*args,**kwargs): pass

class FakeHTTP:
    def __init__(self,data,content_type):
        self.headers={"Content-Type":content_type,"Content-Length":str(len(data))}
        self.rfile=io.BytesIO(data)

class Tests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.store=Stub(self.tmp.name)
        self.feature=PrivateFeatures(self.store)
    def tearDown(self):
        self.store.conn.close()
        self.tmp.cleanup()

    def test_family_two_key_consent_and_revoke(self):
        status,res=self.feature.invite("adult",{"email":"m@example.test","scopes":["city","voice"]})
        self.assertEqual(status,202)
        self.assertEqual(self.feature.shared("mother","adult")[0],403)
        invite=self.feature.family_list("mother")["received"][0]
        self.assertFalse(invite["accepted"])
        self.assertEqual(self.feature.respond("mother",{"invitationId":invite["id"],"accept":True})[0],200)
        status,shared=self.feature.shared("mother","adult")
        self.assertEqual(status,200)
        self.assertEqual(shared["shared"],{"city":"Hyderabad"})
        self.assertTrue(shared["voiceAvailable"])
        self.assertEqual(self.feature.shared("stranger","adult")[0],403)
        self.assertEqual(self.feature.revoke("adult",{"invitationId":invite["id"]})[0],200)
        self.assertEqual(self.feature.shared("mother","adult")[0],403)

    def test_no_member_enumeration_and_no_self_invite(self):
        for email in ["unknown@example.test","a@example.test"]:
            status,body=self.feature.invite("adult",{"email":email,"scopes":["city"]})
            self.assertEqual(status,202)
            self.assertNotIn("unknown",json.dumps(body))
        self.assertEqual(self.feature.family_list("adult")["sent"],[])

    def test_invalid_scope_rejected(self):
        status,_=self.feature.invite("adult",{"email":"m@example.test","scopes":["password"]})
        self.assertEqual(status,400)

    def test_guided_and_ai_explicit_opt_in(self):
        status,body=self.feature.assistant("adult",{"topic":"family","lang":"en"})
        self.assertEqual(status,200)
        self.assertEqual(body["mode"],"guided_questions")
        status,body=self.feature.assistant("adult",{"topic":"family","consentToAI":True})
        self.assertEqual(status,503)
        self.assertEqual(body["code"],"AI_NOT_CONFIGURED")

    def test_wali_brief_requires_explicit_scope_and_acceptance(self):
        brief={"marriageGoals":"A kind home","familyExpectations":"Respectful support",
               "livingPlans":"Discuss moving","weddingExpectations":"Simple nikah",
               "questions":"What would help both families?"}
        self.assertEqual(self.feature.save_wali_brief("adult",{"brief":brief})[0],200)
        self.assertEqual(self.feature.wali_brief("adult")["brief"],brief)
        self.assertEqual(self.feature.save_wali_brief("adult",{"brief":{"questions":"x"*351}})[0],400)
        self.assertEqual(self.feature.shared("mother","adult")[0],403)
        self.feature.invite("adult",{"email":"m@example.test","scopes":["city"]})
        first=self.feature.family_list("mother")["received"][0]
        self.feature.respond("mother",{"invitationId":first["id"],"accept":True})
        self.assertNotIn("waliBrief",self.feature.shared("mother","adult")[1]["shared"])

        # Granting additional permission resets consent until the invitee accepts again.
        self.feature.invite("adult",{"email":"m@example.test","scopes":["wali_brief"]})
        self.assertEqual(self.feature.shared("mother","adult")[0],403)
        second=self.feature.family_list("mother")["received"][0]
        self.assertFalse(second["accepted"])
        self.feature.respond("mother",{"invitationId":second["id"],"accept":True})
        shared=self.feature.shared("mother","adult")[1]["shared"]
        self.assertEqual(shared["waliBrief"]["marriageGoals"],"A kind home")
        self.assertNotIn("city",shared)
        self.assertEqual(self.feature.shared("stranger","adult")[0],403)

        self.feature.delete_wali_brief("adult")
        self.assertNotIn("waliBrief",self.feature.shared("mother","adult")[1]["shared"])
        self.feature.save_wali_brief("adult",{"brief":{"questions":"A new private note"}})
        self.feature.revoke("adult",{"invitationId":second["id"]})
        self.assertEqual(self.feature.shared("mother","adult")[0],403)
        self.feature.purge_member("adult")
        self.assertIsNone(self.store.conn.execute(
            "SELECT owner_id FROM wali_briefs WHERE owner_id='adult'").fetchone())

    def test_audio_mime_and_magic_rejected(self):
        status,body=self.feature.save_voice("adult",FakeHTTP(b"not really webm"*30,"audio/webm"))
        self.assertEqual(status,415)
        self.assertIsNone(self.store.conn.execute("SELECT * FROM private_voice").fetchone())

    def test_member_consent_withdrawal_blocks_access(self):
        self.store.conn.execute("UPDATE consents SET withdrawn=1 WHERE member_id='adult'")
        self.store.conn.commit()
        self.assertFalse(self.feature.member_ok("adult"))

    def test_purge_drops_grants_and_private_audio(self):
        self.feature.invite("adult",{"email":"m@example.test","scopes":["city"]})
        self.feature.purge_member("adult")
        self.assertEqual(self.feature.family_list("adult")["sent"],[])

if __name__=="__main__":unittest.main()
