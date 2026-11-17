"""Launch API safeguards tested on an isolated localhost server and temporary data."""
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from urllib.request import Request,urlopen
from urllib.error import HTTPError

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from server import Handler, Store, Mailer


class Security(unittest.TestCase):
    def test_proxy_ip_cannot_be_spoofed_by_request_header(self):
        caller=SimpleNamespace(client_address=("198.51.100.45", 12345),
            headers={"X-Forwarded-For":"203.0.113.1, 203.0.113.2"},
            store=SimpleNamespace(conf={}))
        self.assertEqual(Handler._client(caller),"198.51.100.45")
        caller.store.conf["AMANIKAH_TRUSTED_PROXY_CIDRS"]="172.20.0.0/16"
        self.assertEqual(Handler._client(caller),"198.51.100.45")
        caller.client_address=("172.20.0.9", 12345)
        self.assertEqual(Handler._client(caller),"203.0.113.1")
        caller.headers["X-Forwarded-For"]="garbage"
        self.assertEqual(Handler._client(caller),"172.20.0.9")
        caller.store.conf["AMANIKAH_TRUSTED_PROXY_CIDRS"]="invalid"
        self.assertEqual(Handler._client(caller),"172.20.0.9")

    def test_analytics_drops_user_text_even_when_label_looks_harmless(self):
        with tempfile.TemporaryDirectory() as tmp:
            conf={"AMANIKAH_DB":str(Path(tmp)/"test.sqlite")}
            s=Store(conf["AMANIKAH_DB"],"test-pepper",Mailer(conf),conf)
            try:
                status, _=s.track_analytics({"name":"landing_view","props":{
                    "source":"tester","path":"/","message":"private story",
                    "intentions":"do not store","reference":"someone@example.test",
                    "choice":"Call 9876543210","custom":"private document"
                }})
                self.assertEqual(status,200)
                values=json.loads(s.conn.execute("SELECT props FROM analytics_events").fetchone()[0])
                self.assertEqual(values,{"source":"tester","path":"/"})
                self.assertNotIn("private story",json.dumps(values))
                status, payload=s.track_analytics({"name":"landing_view","props":{"nested":{"pii":1}}})
                self.assertEqual(status,200)
                self.assertEqual(json.loads(s.conn.execute(
                    "SELECT props FROM analytics_events ORDER BY rowid DESC LIMIT 1").fetchone()[0]),{})
            finally:
                s.close_thread_connection()

    def test_public_server_rejects_signup_when_mail_is_off(self):
        with tempfile.TemporaryDirectory() as tmp:
            sock=socket.socket()
            sock.bind(("127.0.0.1",0))
            port=sock.getsockname()[1]
            sock.close()
            env=dict(os.environ,
                OPS_ADMIN_TOKEN="synthetic-operator-token",SESSION_PEPPER="ci-only-pepper-ci-only-pepper-ci-only-pepper-ci-only-pepper-",
                BIND="127.0.0.1",PORT=str(port),
                AMANIKAH_DB=str(Path(tmp)/"test.sqlite"),
                VOICE_PRIVATE_DIR=str(Path(tmp)/"private"),
                AMANIKAH_ALLOW_OPERATOR_VERIFICATION="0",
                RESEND_API_KEY="", SMTP_HOST="", SMTP_USER="",
                SMTP_PASS="",MAIL_FROM="",OPERATOR_EMAIL="")
            proc=subprocess.Popen([sys.executable,"-u",str(ROOT/"server.py")],
                env=env,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
            base=f"http://127.0.0.1:{port}/api/amanikah"
            try:
                for _ in range(80):
                    try:
                        with urlopen(base+"/health",timeout=1) as response:
                            break
                    except Exception:
                        if proc.poll() is not None:
                            self.fail("API exited during startup")
                        time.sleep(.1)
                else:
                    self.fail("API not reachable")
                body={"email":"unverified@example.test","password":"strong-test-password-1",
                    "age":29,"displayName":"Synthetic adult","consentTerms":True,"consentPrivacy":True}
                req=Request(base+"/auth/register",data=json.dumps(body).encode(),
                    headers={"Content-Type":"application/json"},method="POST")
                try:
                    res=urlopen(req,timeout=3)
                except HTTPError as e:
                    res=e
                self.assertEqual(res.status,503)
                self.assertEqual(json.load(res)["code"],"REGISTRATION_PAUSED")
            finally:
                proc.terminate()
                try:proc.wait(timeout=4)
                except subprocess.TimeoutExpired:proc.kill()
                proc.stderr.close()


if __name__=="__main__":unittest.main()
