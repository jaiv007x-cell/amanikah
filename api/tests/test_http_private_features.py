"""Real HTTP integration tests against a temporary, local Amanikah API instance.

Never uses production accounts, infrastructure, credentials, or customer data.
"""
import io
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

API_ROOT = Path(__file__).resolve().parents[1]

class Integration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        with socket.socket() as sk:
            sk.bind(("127.0.0.1", 0))
            cls.port = sk.getsockname()[1]
        cls.base = "http://127.0.0.1:" + str(cls.port)
        cls.admin = "ci-operator-token-please-never-use-in-production"
        cls.env = dict(os.environ,
            BIND="127.0.0.1", PORT=str(cls.port),
            OPS_ADMIN_TOKEN=cls.admin,
            SESSION_PEPPER="ci-pepper-not-for-production",
            AMANIKAH_DB=str(Path(cls.tmp.name)/"test.sqlite"),
            VOICE_PRIVATE_DIR=str(Path(cls.tmp.name)/"private"),
            PUBLIC_BASE_URL=cls.base,
            AMANIKAH_AI_ENABLED="0",
            AMANIKAH_ALLOW_OPERATOR_VERIFICATION="1",
            MATCHMAKING_LIVE="0",
            OPERATOR_EMAIL="")
        cls.env.pop("GROQ_API_KEY", None)
        cls.env["AMANIKAH_WALI_AI_ENABLED"] = "0"
        cls.process = subprocess.Popen([sys.executable, "-u", str(API_ROOT/"server.py")],
             env=cls.env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        for _ in range(80):
            try:
                status, body = cls.request("GET", "/health")
                if status == 200:
                    break
            except Exception:
                time.sleep(.1)
        else:
            err = cls.process.stderr.read(1000).decode("utf-8","replace") if cls.process.poll() is not None else "API startup timed out"
            raise RuntimeError(err)

    @classmethod
    def tearDownClass(cls):
        cls.process.terminate()
        try: cls.process.wait(timeout=4)
        except subprocess.TimeoutExpired: cls.process.kill()
        cls.process.stderr.close()
        cls.tmp.cleanup()

    @classmethod
    def request(cls, method, path, data=None, token=None, binary=False, admin=False, mime="application/json"):
        headers={"Accept":"application/json"}
        if token:headers["Authorization"]="Bearer "+token
        if admin:headers["X-Ops-Token"]=cls.admin
        if data is not None:
            headers["Content-Type"]=mime
            body=data if binary else json.dumps(data).encode()
        else:
            body=None
        request=Request(cls.base+"/api/amanikah"+path, data=body, method=method, headers=headers)
        try:
            response=urlopen(request,timeout=10)
        except HTTPError as e:
            response=e
        raw=response.read()
        if binary and response.headers.get("Content-Type", "").startswith("audio/"):
            return response.status, raw
        return response.status, json.loads(raw)

    @classmethod
    def registered(cls, email):
        code,response=cls.request("POST","/auth/register",data={
            "email":email,"password":"secure-test-password-1","displayName":"Test Member",
            "age":29,"city":"Hyderabad","consentTerms":True,"consentPrivacy":True
        })
        assert code==201,(code,response)
        mid=response["memberId"]
        code,verify=cls.request("POST","/ops/members/"+mid+"/verify-link",data={},admin=True)
        assert code==200,(code,verify)
        from urllib.parse import urlparse,parse_qs
        token=parse_qs(urlparse(verify["verifyUrl"]).fragment)["token"][0]
        code,checked=cls.request("POST","/auth/verify",data={"token":token})
        assert code==200,(code,checked)
        code,logged=cls.request("POST","/auth/login",data={"email":email,"password":"secure-test-password-1"})
        assert code==200,(code,logged)
        return mid,logged["token"]

    def test_invalid_json_and_oversized_headers_fail_cleanly(self):
        for raw in (b'[]', b'{"bad":', b'null', b'"hello"', b'\\xff'):
            status, body = self.request("POST","/leads",data=raw,binary=True)
            self.assertEqual(status,400,body)
            self.assertEqual(body["code"],"BAD_JSON")
        status, _ = self.request("POST","/leads",data=b"x"*100002,binary=True)
        self.assertEqual(status,400)

    def test_prelaunch_intro_cannot_be_manually_set_mutual(self):
        first, token1 = self.registered("ci-intro-a@example.test")
        second, token2 = self.registered("ci-intro-b@example.test")
        code, response = self.request("POST", "/ops/cases",
            {"memberId": first, "peerMemberId": second, "peerLabel":"Internal draft"},
            admin=True)
        self.assertEqual(code,201,response)
        cid=response["case"]["id"]
        self.assertEqual(response["case"]["status"],"draft")
        for attempted in ("open","mutual"):
            code, result=self.request("PATCH", "/ops/cases/"+cid,
                {"status":attempted},admin=True)
            self.assertEqual(code,409,result)
            self.assertEqual(result["code"],"MATCHMAKING_NOT_LIVE")
        self.assertEqual(self.request("GET","/me/introductions",token=token1)[0],409)
        self.assertEqual(self.request("GET","/me/introductions")[0],401)
        self.assertEqual(self.request("POST","/me/introductions/"+cid+"/respond",
            {"decision":"accept"},token=token1)[0],409)
        # A decline never grants introductions while the live gate is off.
        self.assertEqual(self.request("GET","/members/"+second,token=token1)[0],403)

    def test_consent_withdrawal_revokes_sessions_and_blocks_login(self):
        mid, token = self.registered("ci-consent-revoke@example.test")
        self.assertEqual(self.request("GET","/me",token=token)[0],200)
        self.assertEqual(self.request("POST","/me/withdraw-consent",{},token=token)[0],200)
        self.assertEqual(self.request("GET","/me",token=token)[0],401)
        self.assertEqual(self.request("POST","/auth/login",{
            "email":"ci-consent-revoke@example.test","password":"secure-test-password-1"})[0],403)

    def test_public_al_wali_guidance_is_available_without_groq_key(self):
        status, body = self.request("GET", "/al-wali/status")
        self.assertEqual(status, 200)
        self.assertTrue(body["guidedAvailable"])
        self.assertFalse(body["aiAvailable"])
        status, response = self.request("POST", "/al-wali/chat", {
            "question": "How should we talk about mahr?", "language": "en",
            "consentToAI": True})
        self.assertEqual(status, 200)
        self.assertEqual(response["mode"], "guided")
        self.assertEqual(response["nextStep"]["path"], "/nikah-readiness/")
        bad, response = self.request("POST", "/al-wali/chat",
            {"question": "x" * 601, "language": "en"})
        self.assertEqual(bad, 400)

    def test_wali_http_privacy_scope_and_delete(self):
        owner, ot = self.registered("ci-wali-owner@example.test")
        family, ft = self.registered("ci-wali-family@example.test")
        stranger, st = self.registered("ci-wali-stranger@example.test")
        self.assertEqual(self.request("GET", "/me/family/brief")[0], 401)
        self.assertEqual(self.request("GET", "/me/family/brief",token=ot)[1]["brief"], {})
        code, saved = self.request("POST", "/me/family/brief",
            {"brief":{"marriageGoals":"A simple, caring marriage",
                      "familyExpectations":"Please listen to us both"}},token=ot)
        self.assertEqual(code, 200, saved)
        self.assertFalse(saved["sharedPublicly"])
        self.assertEqual(self.request("POST", "/me/family/brief",
            {"brief":{"questions":"X"*351}},token=ot)[0],400)
        self.assertEqual(self.request("GET", "/me/family/shared/"+owner,token=ft)[0],403)
        self.assertEqual(self.request("GET", "/me/family/shared/"+owner,token=st)[0],403)

        code, invitation=self.request("POST", "/me/family/invite",{
            "email":"ci-wali-family@example.test","scopes":["wali_brief"]},token=ot)
        self.assertEqual(code,202)
        self.assertEqual(self.request("GET", "/me/family/shared/"+owner,token=ft)[0],403)
        incoming=self.request("GET","/me/family",token=ft)[1]["received"][0]
        self.assertEqual(self.request("POST", "/me/family/respond",{
            "invitationId":incoming["id"],"accept":True},token=ft)[0],200)
        code, shared=self.request("GET", "/me/family/shared/"+owner,token=ft)
        self.assertEqual(code,200)
        self.assertEqual(shared["shared"]["waliBrief"]["marriageGoals"],"A simple, caring marriage")
        self.assertNotIn("city",shared["shared"])
        self.assertEqual(self.request("GET","/me/family/shared/"+owner,token=st)[0],403)

        self.assertEqual(self.request("POST", "/me/family/brief/delete",{},token=ot)[0],200)
        self.assertNotIn("waliBrief",self.request("GET", "/me/family/shared/"+owner,token=ft)[1]["shared"])
        self.assertEqual(self.request("POST", "/me/family/brief",
            {"brief":{"questions":"Discuss values before decisions"}},token=ot)[0],200)
        self.assertEqual(self.request("POST", "/me/family/revoke",
            {"invitationId":incoming["id"]},token=ot)[0],200)
        self.assertEqual(self.request("GET", "/me/family/shared/"+owner,token=ft)[0],403)
        self.assertEqual(self.request("POST", "/me/delete",{},token=ot)[0],200)

    def test_production_member_privacy_and_voice(self):
        owner,ot=self.registered("ci-owner@example.test")
        family,ft=self.registered("ci-family@example.test")
        stranger,st=self.registered("ci-stranger@example.test")
        self.assertEqual(self.request("GET","/me/family")[0],401)
        self.assertEqual(self.request("GET","/me/voice/received/"+owner,token=st)[0],403)

        code,invite=self.request("POST","/me/family/invite",
             data={"email":"ci-family@example.test","scopes":["city","voice"]},token=ot)
        self.assertEqual(code,202)
        self.assertEqual(self.request("GET","/me/family/shared/"+owner,token=ft)[0],403)
        code,pending=self.request("GET","/me/family",token=ft)
        self.assertEqual(code,200)
        inv=pending["received"][0]
        self.assertFalse(inv["accepted"])
        self.assertEqual(self.request("POST","/me/family/respond",
          data={"invitationId":inv["id"],"accept":True},token=ft)[0],200)
        code,shared=self.request("GET","/me/family/shared/"+owner,token=ft)
        self.assertEqual(code,200)
        self.assertEqual(shared["shared"].get("city"),"Hyderabad")
        self.assertNotIn("intentions",shared["shared"])
        self.assertEqual(self.request("GET","/me/family/shared/"+owner,token=st)[0],403)

        code,guide=self.request("POST","/me/family/assistant",
           data={"topic":"first","lang":"en","consentToAI":False},token=ot)
        self.assertEqual(code,200)
        self.assertEqual(guide["mode"],"guided_questions")
        code,reply=self.request("POST","/me/family/assistant",
           data={"topic":"first","lang":"en","consentToAI":True},token=ot)
        self.assertEqual(code,503)
        self.assertEqual(reply["code"],"AI_NOT_CONFIGURED")

        self.assertEqual(self.request("POST","/me/voice",data=b"not-a-webm"*10,
             binary=True,mime="audio/webm",token=ot)[0],415)

        if shutil.which("ffmpeg") and shutil.which("ffprobe"):
            audio=subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-f","lavfi",
               "-i","sine=frequency=400:duration=3","-c:a","libopus","-b:a","32k",
               "-f","webm","pipe:1"],capture_output=True,check=True).stdout
            code,created=self.request("POST","/me/voice",data=audio,binary=True,mime="audio/webm",token=ot)
            self.assertEqual(code,201,created)
            code,received=self.request("GET","/me/voice/received/"+owner,token=ft,binary=True)
            self.assertEqual(code,200)
            self.assertEqual(received[:4],bytes.fromhex("1a45dfa3"))
            self.assertEqual(self.request("GET","/me/voice/received/"+owner,token=st)[0],403)

        code,report=self.request("POST","/me/voice/report",data={
            "memberId":owner,
            "reason":"This is a staging-only safety test of inappropriate voice content."
        },token=ft)
        self.assertEqual(code,201,report)
        self.assertTrue(report["reference"].startswith("SF-"))
        self.assertEqual(self.request("POST","/me/family/block",
            data={"memberId":owner},token=ft)[0],200)
        self.assertEqual(self.request("GET","/me/family/shared/"+owner,token=ft)[0],403)
        self.assertEqual(self.request("GET","/me/voice/received/"+owner,token=ft)[0],403)

        self.assertEqual(self.request("POST","/me/family/revoke",
          data={"invitationId":inv["id"]},token=ot)[0],200)
        self.assertEqual(self.request("GET","/me/family/shared/"+owner,token=ft)[0],403)
        self.assertEqual(self.request("GET","/me/voice/received/"+owner,token=ft)[0],403)

        self.assertEqual(self.request("POST","/me/delete",data={},token=ot)[0],200)
        self.assertEqual(self.request("GET","/me/voice",token=ot)[0],401)

if __name__=="__main__":
    unittest.main()
