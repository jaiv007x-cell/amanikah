#!/usr/bin/env python3
"""Amanikah platform API — leads, tickets, members, operator. Separate from AirRates."""
from __future__ import annotations

import hashlib
import ipaddress
import hmac
import json
import os
import re
import secrets
import smtplib
import sqlite3
import threading
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib import error as urlerror
from urllib import request as urlrequest
from urllib.parse import parse_qs, urlparse

from private_features import PrivateFeatures
from al_wali import AlWali

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
LEAD_STATUSES = ("new", "contacted", "qualified", "converted", "closed")
TICKET_STATUSES = ("new", "acknowledged", "in_progress", "resolved", "closed")
CASE_STATUSES = ("draft", "open", "mutual", "paused", "closed")
VERIFY_STATUSES = ("requested", "in_review", "completed", "unable", "cancelled")
FULFILL_STATUSES = ("queued", "in_progress", "delivered", "blocked", "cancelled")


def utcnow():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def new_id(prefix):
    return f"{prefix}_{secrets.token_hex(8)}"


def hash_password(password: str, pepper: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", (pepper + password).encode(), bytes.fromhex(salt), 200_000)
    return f"pbkdf2$200000${salt}${digest.hex()}"


def verify_password(password: str, stored: str, pepper: str) -> bool:
    try:
        algo, rounds, salt, digest = stored.split("$", 3)
        if algo != "pbkdf2":
            return False
        check = hashlib.pbkdf2_hmac("sha256", (pepper + password).encode(), bytes.fromhex(salt), int(rounds))
        return hmac.compare_digest(check.hex(), digest)
    except Exception:
        return False


def fingerprint(parts) -> str:
    raw = "|".join(str(p or "").strip().lower() for p in parts)
    return hashlib.sha256(raw.encode()).hexdigest()


class RateLimiter:
    def __init__(self, limit=20, window=60, max_clients=50000):
        self.limit = limit
        self.window = window
        self.max_clients = max_clients
        self.hits = defaultdict(deque)
        self.lock = threading.Lock()
        self.calls = 0

    def allow(self, key: str) -> bool:
        now = time.time()
        with self.lock:
            # Reclaim stale buckets to prevent long-lived API processes from
            # retaining an unbounded set of client IP addresses.
            self.calls += 1
            if self.calls % 256 == 0:
                expired = [client for client, values in self.hits.items()
                           if not values or now - values[-1] > self.window]
                for client in expired:
                    self.hits.pop(client, None)
            if key not in self.hits and len(self.hits) >= self.max_clients:
                return False
            bucket = self.hits[key]
            while bucket and now - bucket[0] > self.window:
                bucket.popleft()
            if len(bucket) >= self.limit:
                return False
            bucket.append(now)
            return True


class Mailer:
    def __init__(self, conf: dict):
        self.conf = conf

    @property
    def configured(self) -> bool:
        return bool(self.conf.get("RESEND_API_KEY") or (self.conf.get("SMTP_HOST") and self.conf.get("SMTP_USER")))

    def send(self, to: str, subject: str, body: str) -> dict:
        if not to:
            return {"ok": False, "code": "NO_OPERATOR_EMAIL", "message": "OPERATOR_EMAIL is not configured."}
        if self.conf.get("RESEND_API_KEY"):
            return self._resend(to, subject, body)
        if self.conf.get("SMTP_HOST") and self.conf.get("SMTP_USER"):
            return self._smtp(to, subject, body)
        return {"ok": False, "code": "MAIL_NOT_CONFIGURED", "message": "No transactional email provider is configured."}

    def _resend(self, to, subject, body):
        payload = json.dumps({
            "from": self.conf.get("MAIL_FROM") or "Amanikah <noreply@amanikah.com>",
            "to": [to],
            "subject": subject,
            "text": body,
        }).encode()
        req = urlrequest.Request(
            "https://api.resend.com/emails",
            data=payload,
            method="POST",
            headers={
                "Authorization": "Bearer " + self.conf["RESEND_API_KEY"],
                "Content-Type": "application/json",
            },
        )
        try:
            with urlrequest.urlopen(req, timeout=20) as res:
                data = json.loads(res.read().decode() or "{}")
                return {"ok": True, "provider": "resend", "providerId": data.get("id")}
        except urlerror.HTTPError as err:
            detail = err.read().decode("utf-8", "ignore")[:300]
            return {"ok": False, "code": "MAIL_FAILED", "message": detail or str(err)}
        except Exception as err:
            return {"ok": False, "code": "MAIL_FAILED", "message": str(err)}

    def _smtp(self, to, subject, body):
        msg = EmailMessage()
        msg["From"] = self.conf.get("MAIL_FROM") or self.conf["SMTP_USER"]
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(body)
        try:
            host = self.conf["SMTP_HOST"]
            port = int(self.conf.get("SMTP_PORT") or 587)
            if self.conf.get("SMTP_TLS", "1") == "1":
                with smtplib.SMTP(host, port, timeout=20) as smtp:
                    smtp.starttls()
                    smtp.login(self.conf["SMTP_USER"], self.conf.get("SMTP_PASS") or "")
                    smtp.send_message(msg)
            else:
                with smtplib.SMTP(host, port, timeout=20) as smtp:
                    smtp.login(self.conf["SMTP_USER"], self.conf.get("SMTP_PASS") or "")
                    smtp.send_message(msg)
            return {"ok": True, "provider": "smtp"}
        except Exception as err:
            return {"ok": False, "code": "MAIL_FAILED", "message": str(err)}


class Store:
    def __init__(self, db_path: str, pepper: str, mailer: Mailer, conf: dict):
        self.pepper = pepper
        self.mailer = mailer
        self.conf = conf
        # A ThreadingHTTPServer must never share a transaction across requests.
        # SQLite connections are thread-local; WAL permits concurrent readers.
        self.db_path = db_path
        self._thread = threading.local()
        self.lock = threading.RLock()
        self._migrate()

    @property
    def conn(self):
        conn = getattr(self._thread, "conn", None)
        if conn is None:
            conn = sqlite3.connect(self.db_path, timeout=15)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA foreign_keys=ON")
            conn.execute("PRAGMA busy_timeout=15000")
            self._thread.conn = conn
        return conn

    def matchmaking_ready(self):
        # A single environment toggle is not enough to make real people visible.
        # These flags are operator attestations, not substitutes for evidence.
        gates = ("MATCHMAKING_LIVE", "AMANIKAH_SAFETY_REVIEW_APPROVED",
                 "AMANIKAH_OFFSITE_RESTORE_VERIFIED", "AMANIKAH_REAL_ACCOUNT_QA_APPROVED")
        return all(self.conf.get(name) == "1" for name in gates)

    def close_thread_connection(self):
        conn = getattr(self._thread, "conn", None)
        if conn is not None:
            conn.close()
            del self._thread.conn

    def _migrate(self):
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS leads (
              id TEXT PRIMARY KEY,
              reference TEXT UNIQUE NOT NULL,
              name TEXT NOT NULL,
              email TEXT NOT NULL,
              age INTEGER NOT NULL,
              city TEXT NOT NULL,
              home TEXT NOT NULL,
              note TEXT NOT NULL,
              source TEXT,
              referral TEXT,
              status TEXT NOT NULL,
              fingerprint TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              deleted_at TEXT
            );
            CREATE TABLE IF NOT EXISTS tickets (
              id TEXT PRIMARY KEY,
              reference TEXT UNIQUE NOT NULL,
              kind TEXT NOT NULL,
              name TEXT NOT NULL,
              email TEXT NOT NULL,
              topic TEXT NOT NULL,
              message TEXT NOT NULL,
              status TEXT NOT NULL,
              urgent INTEGER NOT NULL DEFAULT 0,
              fingerprint TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS members (
              id TEXT PRIMARY KEY,
              email TEXT UNIQUE NOT NULL,
              password_hash TEXT NOT NULL,
              role TEXT NOT NULL,
              email_verified INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              deleted_at TEXT,
              is_demo INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS profiles (
              member_id TEXT PRIMARY KEY,
              display_name TEXT,
              age INTEGER,
              city TEXT,
              jurisdiction TEXT,
              intentions TEXT,
              visibility TEXT NOT NULL DEFAULT 'private',
              FOREIGN KEY(member_id) REFERENCES members(id)
            );
            CREATE TABLE IF NOT EXISTS consents (
              member_id TEXT PRIMARY KEY,
              terms INTEGER NOT NULL,
              privacy INTEGER NOT NULL,
              withdrawn INTEGER NOT NULL DEFAULT 0,
              updated_at TEXT NOT NULL,
              FOREIGN KEY(member_id) REFERENCES members(id)
            );
            CREATE TABLE IF NOT EXISTS sessions (
              token_hash TEXT PRIMARY KEY,
              member_id TEXT NOT NULL,
              expires_at TEXT NOT NULL,
              created_at TEXT NOT NULL,
              FOREIGN KEY(member_id) REFERENCES members(id)
            );
            CREATE TABLE IF NOT EXISTS email_tokens (
              token_hash TEXT PRIMARY KEY,
              member_id TEXT NOT NULL,
              purpose TEXT NOT NULL,
              expires_at TEXT NOT NULL,
              used_at TEXT,
              FOREIGN KEY(member_id) REFERENCES members(id)
            );
            CREATE TABLE IF NOT EXISTS introduction_cases (
              id TEXT PRIMARY KEY,
              reference TEXT UNIQUE NOT NULL,
              lead_id TEXT,
              member_id TEXT,
              peer_label TEXT,
              status TEXT NOT NULL,
              notes TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS introduction_consents (
              case_id TEXT NOT NULL,
              member_id TEXT NOT NULL,
              decision TEXT NOT NULL CHECK(decision IN ('accepted','declined')),
              created_at TEXT NOT NULL,
              PRIMARY KEY(case_id, member_id),
              FOREIGN KEY(case_id) REFERENCES introduction_cases(id),
              FOREIGN KEY(member_id) REFERENCES members(id)
            );
            CREATE TABLE IF NOT EXISTS verification_requests (
              id TEXT PRIMARY KEY,
              reference TEXT UNIQUE NOT NULL,
              member_id TEXT,
              claim TEXT NOT NULL,
              status TEXT NOT NULL,
              result_note TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS fulfillment (
              id TEXT PRIMARY KEY,
              service_id TEXT NOT NULL,
              order_ref TEXT,
              member_id TEXT,
              lead_id TEXT,
              status TEXT NOT NULL,
              notes TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS notifications (
              id TEXT PRIMARY KEY,
              channel TEXT NOT NULL,
              destination TEXT,
              subject TEXT NOT NULL,
              body TEXT NOT NULL,
              status TEXT NOT NULL,
              related_type TEXT,
              related_id TEXT,
              error TEXT,
              created_at TEXT NOT NULL,
              sent_at TEXT
            );
            CREATE TABLE IF NOT EXISTS audit_log (
              id TEXT PRIMARY KEY,
              action TEXT NOT NULL,
              actor TEXT,
              entity_type TEXT,
              entity_id TEXT,
              detail TEXT,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS analytics_events (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              props TEXT,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS shares (
              id TEXT PRIMARY KEY,
              kind TEXT NOT NULL,
              payload TEXT NOT NULL,
              revoke_token_hash TEXT NOT NULL,
              revoked_at TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
            CREATE INDEX IF NOT EXISTS idx_tickets_kind ON tickets(kind, status);
            CREATE INDEX IF NOT EXISTS idx_shares_kind ON shares(kind);
            """
        )
        # Additive migration for older production databases (no data loss).
        columns = {row["name"] for row in self.conn.execute("PRAGMA table_info(introduction_cases)")}
        if "peer_member_id" not in columns:
            self.conn.execute("ALTER TABLE introduction_cases ADD COLUMN peer_member_id TEXT")
        self.conn.commit()

    def audit(self, action, actor=None, entity_type=None, entity_id=None, detail=None):
        self.conn.execute(
            "INSERT INTO audit_log (id, action, actor, entity_type, entity_id, detail, created_at) VALUES (?,?,?,?,?,?,?)",
            (new_id("aud"), action, actor, entity_type, entity_id, detail, utcnow()),
        )
        self.conn.commit()

    def queue_notification(self, subject, body, related_type, related_id):
        dest = self.conf.get("OPERATOR_EMAIL") or ""
        nid = new_id("ntf")
        now = utcnow()
        result = self.mailer.send(dest, subject, body) if dest else {"ok": False, "code": "NO_OPERATOR_EMAIL", "message": "OPERATOR_EMAIL is not configured."}
        if not self.mailer.configured and result.get("code") != "NO_OPERATOR_EMAIL":
            result = {"ok": False, "code": "MAIL_NOT_CONFIGURED", "message": "No transactional email provider is configured."}
        status = "sent" if result.get("ok") else "queued" if result.get("code") in ("MAIL_NOT_CONFIGURED", "NO_OPERATOR_EMAIL") else "failed"
        # Always persist. Never discard.
        self.conn.execute(
            "INSERT INTO notifications (id, channel, destination, subject, body, status, related_type, related_id, error, created_at, sent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (
                nid,
                "email",
                dest or None,
                subject,
                body,
                status if result.get("ok") or result.get("code") in ("MAIL_NOT_CONFIGURED", "NO_OPERATOR_EMAIL") else "failed",
                related_type,
                related_id,
                None if result.get("ok") else (result.get("message") or result.get("code")),
                now,
                now if result.get("ok") else None,
            ),
        )
        self.conn.commit()
        return {
            "notificationId": nid,
            "email": {
                "attempted": bool(dest and self.mailer.configured),
                "sent": bool(result.get("ok")),
                "code": None if result.get("ok") else result.get("code"),
                "message": None if result.get("ok") else result.get("message"),
            },
            "stored": True,
        }

    def create_lead(self, body, client_ip):
        # Honeypot: browsers leave this empty; bots that fill it are rejected quietly without storing.
        if str(body.get("company") or body.get("website") or "").strip():
            return 400, {"ok": False, "code": "REJECTED", "message": "Request could not be accepted."}
        name = str(body.get("name") or "").strip()[:80]
        email = str(body.get("email") or "").strip().lower()[:120]
        city = str(body.get("city") or "").strip()[:80]
        home = str(body.get("home") or "").strip()[:80]
        note = str(body.get("note") or "").strip()[:2000]
        source = str(body.get("source") or "signup").strip()[:40]
        referral = str(body.get("referral") or "").strip()[:120]
        age = body.get("age")
        try:
            age = int(age)
        except Exception:
            return 400, {"ok": False, "code": "INVALID_AGE"}
        if not name or not EMAIL_RE.match(email) or not city or not home or len(note) < 20:
            return 400, {"ok": False, "code": "VALIDATION", "message": "Name, email, city, home preference, and a note of at least 20 characters are required."}
        if age < 21 or age > 80:
            return 400, {"ok": False, "code": "AGE", "message": "Amanikah is for adults aged 21 to 80."}
        if not body.get("consent"):
            return 400, {"ok": False, "code": "CONSENT", "message": "Consent is required."}
        fp = fingerprint([email, city, note[:80], client_ip])
        recent = self.conn.execute(
            "SELECT id, reference, created_at FROM leads WHERE fingerprint = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1",
            (fp,),
        ).fetchone()
        if recent:
            created = datetime.fromisoformat(recent["created_at"])
            if datetime.now(timezone.utc) - created.replace(tzinfo=timezone.utc) < timedelta(hours=24):
                return 409, {
                    "ok": False,
                    "code": "DUPLICATE",
                    "message": "A matching waitlist request was already received in the last 24 hours.",
                    "reference": recent["reference"],
                }
        lead_id = new_id("lead")
        reference = "AK-" + secrets.token_hex(3).upper()
        now = utcnow()
        self.conn.execute(
            "INSERT INTO leads (id, reference, name, email, age, city, home, note, source, referral, status, fingerprint, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (lead_id, reference, name, email, age, city, home, note, source, referral or None, "new", fp, now, now),
        )
        self.conn.commit()
        self.audit("lead_created", actor=email, entity_type="lead", entity_id=lead_id, detail=reference)
        # Email preview omits matrimonial note content; full record is in /ops/.
        notify = self.queue_notification(
            subject=f"[Amanikah] Waitlist {reference}",
            body=(
                f"A waitlist request was accepted.\n"
                f"Reference: {reference}\n"
                f"Source: {source}\n"
                f"City (coarse): {city}\n"
                f"Open /ops/ to review the full record. Do not treat this email as a customer registration.\n"
            ),
            related_type="lead",
            related_id=lead_id,
        )
        self.track_analytics({"name": "signup_completed", "props": {"reference": reference, "source": source}})
        self.track_analytics({"name": "lead_qualified", "props": {"reference": reference, "source": source}})
        mode = "waitlist" if self.conf.get("WAITLIST_MODE", "1") == "1" else "live"
        return 201, {
            "ok": True,
            "reference": reference,
            "status": "new",
            "mode": mode,
            "matchmakingLive": self.matchmaking_ready(),
            "message": "Your waitlist request was accepted. Matchmaking is not operational yet; an operator will review this request.",
            "notification": notify,
        }

    def create_ticket(self, body, client_ip, urgent=False):
        if str(body.get("company") or body.get("website") or "").strip():
            return 400, {"ok": False, "code": "REJECTED", "message": "Request could not be accepted."}
        name = str(body.get("name") or "").strip()[:80]
        email = str(body.get("email") or "").strip().lower()[:120]
        topic = str(body.get("topic") or "").strip()[:80]
        message = str(body.get("message") or "").strip()[:4000]
        kind = "safety" if urgent or str(body.get("kind") or "").lower() == "safety" else "support"
        if not name or not EMAIL_RE.match(email) or not topic or len(message) < 20:
            return 400, {"ok": False, "code": "VALIDATION", "message": "Name, email, topic, and a message of at least 20 characters are required."}
        fp = fingerprint([kind, email, topic, message[:80], client_ip])
        recent = self.conn.execute(
            "SELECT reference, created_at FROM tickets WHERE fingerprint = ? ORDER BY created_at DESC LIMIT 1",
            (fp,),
        ).fetchone()
        if recent:
            created = datetime.fromisoformat(recent["created_at"])
            if datetime.now(timezone.utc) - created.replace(tzinfo=timezone.utc) < timedelta(hours=6):
                return 409, {
                    "ok": False,
                    "code": "DUPLICATE",
                    "message": "A matching message was already received recently.",
                    "reference": recent["reference"],
                }
        tid = new_id("tkt")
        reference = ("SF-" if kind == "safety" else "SP-") + secrets.token_hex(3).upper()
        now = utcnow()
        self.conn.execute(
            "INSERT INTO tickets (id, reference, kind, name, email, topic, message, status, urgent, fingerprint, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (tid, reference, kind, name, email, topic, message, "new", 1 if kind == "safety" else 0, fp, now, now),
        )
        self.conn.commit()
        self.audit("ticket_created", actor=email, entity_type="ticket", entity_id=tid, detail=kind)
        subject = f"[Amanikah {'SAFETY' if kind == 'safety' else 'Support'}] {reference}"
        notify = self.queue_notification(
            subject=subject,
            body=(
                f"A {kind} ticket was accepted.\n"
                f"Reference: {reference}\n"
                f"Topic: {topic}\n"
                f"Open /ops/ to review the full message. Message body is not included in this preview.\n"
            ),
            related_type="ticket",
            related_id=tid,
        )
        return 201, {
            "ok": True,
            "reference": reference,
            "kind": kind,
            "status": "new",
            "message": "Your message was accepted by Amanikah.",
            "emergency": (
                "If you are in immediate danger, contact local emergency services now. Amanikah is not an emergency hotline."
                if kind == "safety"
                else None
            ),
            "notification": notify,
        }

    def register_member(self, body):
        email = str(body.get("email") or "").strip().lower()
        password = str(body.get("password") or "")
        display = str(body.get("displayName") or "").strip()[:80]
        age = body.get("age")
        try:
            age = int(age)
        except Exception:
            return 400, {"ok": False, "code": "INVALID_AGE"}
        if not EMAIL_RE.match(email) or len(password) < 10 or not display:
            return 400, {"ok": False, "code": "VALIDATION", "message": "Email, display name, and a password of at least 10 characters are required."}
        if age < 21 or age > 80:
            return 400, {"ok": False, "code": "AGE"}
        if not body.get("consentTerms") or not body.get("consentPrivacy"):
            return 400, {"ok": False, "code": "CONSENT"}
        existing = self.conn.execute("SELECT id, is_demo, deleted_at FROM members WHERE email = ?", (email,)).fetchone()
        if existing and not existing["deleted_at"]:
            if existing["is_demo"]:
                return 409, {"ok": False, "code": "DEMO_EMAIL", "message": "This email belongs to the demo membership and cannot be used for a production account."}
            return 409, {"ok": False, "code": "EXISTS", "message": "An account with this email already exists."}
        mid = new_id("mem")
        now = utcnow()
        self.conn.execute(
            "INSERT INTO members (id, email, password_hash, role, email_verified, created_at, updated_at, is_demo) VALUES (?,?,?,?,0,?,?,0)",
            (mid, email, hash_password(password, self.pepper), "member", now, now),
        )
        self.conn.execute(
            "INSERT INTO profiles (member_id, display_name, age, city, jurisdiction, intentions, visibility) VALUES (?,?,?,?,?,?, 'private')",
            (mid, display, age, str(body.get("city") or "").strip()[:80], str(body.get("jurisdiction") or "").strip()[:40], str(body.get("intentions") or "").strip()[:500]),
        )
        self.conn.execute(
            "INSERT INTO consents (member_id, terms, privacy, withdrawn, updated_at) VALUES (?,?,?,0,?)",
            (mid, 1, 1, now),
        )
        token = secrets.token_urlsafe(24)
        self.conn.execute(
            "INSERT INTO email_tokens (token_hash, member_id, purpose, expires_at) VALUES (?,?,?,?)",
            (hashlib.sha256(token.encode()).hexdigest(), mid, "verify", (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()),
        )
        self.conn.commit()
        self.audit("member_registered", actor=email, entity_type="member", entity_id=mid)
        verify_url = f"{self.conf.get('PUBLIC_BASE_URL')}/account/verify.html#token={token}"
        # Attempt member-facing verification email when mail works
        member_mail = {"sent": False, "ok": False}
        if self.mailer.configured:
            member_mail = self.mailer.send(email, "Verify your Amanikah account", f"Confirm your email:\n{verify_url}\n\nIf you did not create this account, ignore this message.")
        # Operator outbox always gets the verify URL so accounts remain operable when member mail fails.
        notify = self.queue_notification(
            subject=f"[Amanikah] Member signup {mid[-8:]}",
            body=(
                f"A production membership was created (email redacted in this preview).\n"
                f"Member id: {mid}\n"
                f"Verification is required before private routes work.\n"
                f"Member email delivery: {'sent' if member_mail.get('ok') else 'not_sent'}.\n"
                f"Operator verification URL (do not forward publicly):\n{verify_url}\n"
            ),
            related_type="member",
            related_id=mid,
        )
        self.track_analytics({"name": "signup_completed", "props": {"memberId": mid, "kind": "production_account"}})
        return 201, {
            "ok": True,
            "memberId": mid,
            "emailVerified": False,
            "verifyTokenIssued": True,
            "message": "Account created. Verify your email before accessing private member routes.",
            "operatorNotification": notify,
            "memberEmail": {"sent": bool(member_mail.get("ok")), "code": member_mail.get("code")},
            "demo": False,
        }

    def issue_verify_link(self, member_id: str):
        row = self.conn.execute(
            "SELECT id, email, email_verified, deleted_at, is_demo FROM members WHERE id = ?",
            (member_id,),
        ).fetchone()
        if not row or row["deleted_at"] or row["is_demo"]:
            return 404, {"ok": False, "code": "NOT_FOUND"}
        if row["email_verified"]:
            return 200, {"ok": True, "alreadyVerified": True}
        token = secrets.token_urlsafe(24)
        self.conn.execute(
            "INSERT INTO email_tokens (token_hash, member_id, purpose, expires_at) VALUES (?,?,?,?)",
            (hashlib.sha256(token.encode()).hexdigest(), member_id, "verify", (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()),
        )
        self.conn.commit()
        verify_url = f"{self.conf.get('PUBLIC_BASE_URL')}/account/verify.html#token={token}"
        self.audit("verify_link_issued", actor="ops", entity_type="member", entity_id=member_id)
        return 200, {"ok": True, "memberId": member_id, "verifyUrl": verify_url}

    def verify_email(self, token: str):
        th = hashlib.sha256(token.encode()).hexdigest()
        row = self.conn.execute("SELECT * FROM email_tokens WHERE token_hash = ? AND purpose = 'verify'", (th,)).fetchone()
        if not row or row["used_at"]:
            return 400, {"ok": False, "code": "INVALID_TOKEN"}
        account = self.conn.execute(
            "SELECT m.deleted_at,c.withdrawn FROM members m JOIN consents c ON c.member_id=m.id WHERE m.id=?",
            (row["member_id"],)).fetchone()
        if not account or account["deleted_at"] or account["withdrawn"]:
            return 400, {"ok": False, "code": "INVALID_TOKEN"}
        if datetime.fromisoformat(row["expires_at"]).replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            return 400, {"ok": False, "code": "EXPIRED_TOKEN"}
        self.conn.execute("UPDATE members SET email_verified = 1, updated_at = ? WHERE id = ?", (utcnow(), row["member_id"]))
        self.conn.execute("UPDATE email_tokens SET used_at = ? WHERE token_hash = ?", (utcnow(), th))
        self.conn.commit()
        self.audit("email_verified", entity_type="member", entity_id=row["member_id"])
        return 200, {"ok": True, "verified": True}

    def login(self, body):
        email = str(body.get("email") or "").strip().lower()
        password = str(body.get("password") or "")
        row = self.conn.execute("SELECT * FROM members WHERE email = ? AND deleted_at IS NULL", (email,)).fetchone()
        if not row or row["is_demo"]:
            return 401, {"ok": False, "code": "INVALID_CREDENTIALS", "message": "Production login only. Demo accounts stay on /login."}
        if not verify_password(password, row["password_hash"], self.pepper):
            return 401, {"ok": False, "code": "INVALID_CREDENTIALS"}
        if not row["email_verified"]:
            return 403, {"ok": False, "code": "EMAIL_UNVERIFIED", "message": "Verify your email before signing in."}
        consent = self.conn.execute("SELECT withdrawn FROM consents WHERE member_id=?", (row["id"],)).fetchone()
        if not consent or consent["withdrawn"]:
            return 403, {"ok": False, "code": "CONSENT_WITHDRAWN"}
        token = secrets.token_urlsafe(32)
        self.conn.execute(
            "INSERT INTO sessions (token_hash, member_id, expires_at, created_at) VALUES (?,?,?,?)",
            (
                hashlib.sha256(token.encode()).hexdigest(),
                row["id"],
                (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
                utcnow(),
            ),
        )
        self.conn.commit()
        return 200, {"ok": True, "token": token, "member": self.public_member(row["id"])}

    def logout(self, token: str):
        if token:
            self.conn.execute("DELETE FROM sessions WHERE token_hash=?",
                              (hashlib.sha256(token.encode()).hexdigest(),))
            self.conn.commit()
        return 200, {"ok": True, "signedOut": True}

    def session_member(self, token: str):
        if not token:
            return None
        th = hashlib.sha256(token.encode()).hexdigest()
        row = self.conn.execute(
            "SELECT m.* FROM sessions s JOIN members m ON m.id = s.member_id WHERE s.token_hash = ? AND m.deleted_at IS NULL",
            (th,),
        ).fetchone()
        if not row:
            return None
        sess = self.conn.execute("SELECT expires_at FROM sessions WHERE token_hash = ?", (th,)).fetchone()
        if datetime.fromisoformat(sess["expires_at"]).replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            return None
        if row["is_demo"] or not row["email_verified"]:
            return None
        consent = self.conn.execute("SELECT withdrawn FROM consents WHERE member_id=?", (row["id"],)).fetchone()
        if not consent or consent["withdrawn"]:
            return None
        return row

    def public_member(self, member_id: str):
        m = self.conn.execute("SELECT * FROM members WHERE id = ?", (member_id,)).fetchone()
        p = self.conn.execute("SELECT * FROM profiles WHERE member_id = ?", (member_id,)).fetchone()
        c = self.conn.execute("SELECT * FROM consents WHERE member_id = ?", (member_id,)).fetchone()
        if not m:
            return None
        return {
            "id": m["id"],
            "email": m["email"],
            "role": m["role"],
            "emailVerified": bool(m["email_verified"]),
            "demo": bool(m["is_demo"]),
            "profile": dict(p) if p else None,
            "consent": {"terms": bool(c["terms"]), "privacy": bool(c["privacy"]), "withdrawn": bool(c["withdrawn"])} if c else None,
        }

    def update_profile(self, member_id, body):
        consent = self.conn.execute("SELECT * FROM consents WHERE member_id = ?", (member_id,)).fetchone()
        if consent and consent["withdrawn"]:
            return 403, {"ok": False, "code": "CONSENT_WITHDRAWN"}
        fields = {
            "display_name": str(body.get("displayName") or "").strip()[:80],
            "city": str(body.get("city") or "").strip()[:80],
            "jurisdiction": str(body.get("jurisdiction") or "").strip()[:40],
            "intentions": str(body.get("intentions") or "").strip()[:500],
            "visibility": "private" if body.get("visibility") != "selected" else "selected",
        }
        self.conn.execute(
            "UPDATE profiles SET display_name=?, city=?, jurisdiction=?, intentions=?, visibility=? WHERE member_id=?",
            (fields["display_name"], fields["city"], fields["jurisdiction"], fields["intentions"], fields["visibility"], member_id),
        )
        self.conn.execute("UPDATE members SET updated_at=? WHERE id=?", (utcnow(), member_id))
        self.conn.commit()
        self.audit("profile_updated", actor=member_id, entity_type="member", entity_id=member_id)
        return 200, {"ok": True, "member": self.public_member(member_id)}

    def withdraw_consent(self, member_id):
        if hasattr(self, "private_features"):
            self.private_features.purge_member(member_id)
        self._pause_member_introductions(member_id)
        self.conn.execute("UPDATE consents SET withdrawn=1, updated_at=? WHERE member_id=?", (utcnow(), member_id))
        self.conn.execute("UPDATE profiles SET visibility='private' WHERE member_id=?", (member_id,))
        # Withdrawing consent also immediately invalidates all active sessions.
        self.conn.execute("DELETE FROM sessions WHERE member_id=?", (member_id,))
        self.conn.commit()
        self.audit("consent_withdrawn", actor=member_id, entity_type="member", entity_id=member_id)
        return 200, {"ok": True, "withdrawn": True}

    def delete_account(self, member_id):
        if hasattr(self, "private_features"):
            self.private_features.purge_member(member_id)
        self._pause_member_introductions(member_id)
        now = utcnow()
        self.conn.execute("UPDATE members SET deleted_at=?, email=?, password_hash='', updated_at=? WHERE id=?", (now, f"deleted-{member_id}@amanikah.invalid", now, member_id))
        self.conn.execute("UPDATE profiles SET display_name='Deleted member', intentions='', city='', visibility='private' WHERE member_id=?", (member_id,))
        self.conn.execute("DELETE FROM sessions WHERE member_id=?", (member_id,))
        self.conn.commit()
        self.audit("account_deleted", actor=member_id, entity_type="member", entity_id=member_id)
        return 200, {"ok": True, "deleted": True}

    def get_profile_authorized(self, actor, target_id):
        if not actor:
            return 401, {"ok": False, "code": "UNAUTHENTICATED"}
        if actor["id"] != target_id and actor["role"] not in ("admin", "operator"):
            return 403, {"ok": False, "code": "FORBIDDEN", "message": "Private profiles are not visible to other members."}
        member = self.public_member(target_id)
        if not member or member.get("demo"):
            return 404, {"ok": False, "code": "NOT_FOUND"}
        return 200, {"ok": True, "member": member}

    def create_share(self, body):
        kind = str(body.get("kind") or "simple-nikah").strip()[:40]
        payload = body.get("payload")
        if not isinstance(payload, dict):
            return 400, {"ok": False, "code": "VALIDATION", "message": "payload object is required."}
        # Preferences-only: strip anything that looks like private profile content
        clean = {
            "v": 1,
            "lang": str(payload.get("lang") or "en")[:8],
            "template": str(payload.get("template") or "")[:40],
            "celebration": str(payload.get("celebration") or "")[:120],
            "family": str(payload.get("family") or "")[:120],
            "home": str(payload.get("home") or "")[:120],
            "visibility": "link",
        }
        if payload.get("firstName"):
            clean["firstName"] = str(payload.get("firstName"))[:40]
        if not clean["celebration"]:
            return 400, {"ok": False, "code": "VALIDATION", "message": "Pledge preferences are required."}
        sid = new_id("shr")
        revoke_token = secrets.token_urlsafe(24)
        now = utcnow()
        self.conn.execute(
            "INSERT INTO shares (id, kind, payload, revoke_token_hash, created_at, updated_at) VALUES (?,?,?,?,?,?)",
            (sid, kind, json.dumps(clean), hashlib.sha256(revoke_token.encode()).hexdigest(), now, now),
        )
        self.conn.commit()
        self.audit("share_created", entity_type="share", entity_id=sid, detail=kind)
        return 201, {
            "ok": True,
            "shareId": sid,
            "revokeToken": revoke_token,
            "path": f"/simple-nikah/share.html?s={sid}",
        }

    def get_share(self, share_id: str):
        row = self.conn.execute("SELECT * FROM shares WHERE id = ?", (share_id,)).fetchone()
        if not row:
            return 404, {"ok": False, "code": "NOT_FOUND", "revoked": False}
        if row["revoked_at"]:
            return 410, {"ok": False, "code": "REVOKED", "revoked": True}
        try:
            payload = json.loads(row["payload"])
        except json.JSONDecodeError:
            return 500, {"ok": False, "code": "CORRUPT"}
        return 200, {"ok": True, "shareId": share_id, "kind": row["kind"], "payload": payload, "revoked": False}

    def revoke_share(self, share_id: str, revoke_token: str):
        row = self.conn.execute("SELECT * FROM shares WHERE id = ?", (share_id,)).fetchone()
        if not row:
            return 404, {"ok": False, "code": "NOT_FOUND"}
        expected = row["revoke_token_hash"]
        provided = hashlib.sha256(str(revoke_token or "").encode()).hexdigest()
        if not hmac.compare_digest(expected, provided):
            return 403, {"ok": False, "code": "FORBIDDEN", "message": "Revoke token is invalid."}
        if row["revoked_at"]:
            return 200, {"ok": True, "revoked": True, "already": True}
        now = utcnow()
        self.conn.execute("UPDATE shares SET revoked_at=?, updated_at=? WHERE id=?", (now, now, share_id))
        self.conn.commit()
        self.audit("share_revoked", entity_type="share", entity_id=share_id)
        return 200, {"ok": True, "revoked": True}

    def track_analytics(self, body):
        name = str(body.get("name") or "").strip()
        allowed = {
            "landing_view", "quiz_started", "quiz_completed", "pledge_completed",
            "signup_started", "signup_completed", "lead_qualified", "operator_contacted",
            "introduction_requested", "introduction_accepted",
            "checkout_started", "payment_confirmed", "service_fulfilled", "refund_completed",
            "qualified_signup", "waitlist_submitted", "contact_submitted", "safety_submitted",
            "quiz_to_signup", "pledge_to_signup", "pricing_viewed", "purchase_completed",
            "customer_acquired", "share_created", "share_revoked", "share_visited",
            "film_open", "film_perspective_chosen", "film_priority_chosen", "film_cta_clicked",
        }
        if name not in allowed:
            return 400, {"ok": False, "code": "UNKNOWN_EVENT"}
        props = body.get("props") or {}
        if not isinstance(props, dict):
            return 400, {"ok": False, "code": "BAD_PROPS"}
        # Positive allowlist: browser events must never log arbitrary user text.
        allowed_props = {"path", "source", "reference", "kind", "language", "step", "choice", "template"}
        safe = {}
        for key, val in props.items():
            if (key in allowed_props and isinstance(val, (str, int))
                    and len(str(val)) <= 80
                    and not EMAIL_RE.search(str(val))
                    and not re.search(r"\+?\d[\d .()\-]{8,}\d", str(val))):
                safe[key] = val
        self.conn.execute(
            "INSERT INTO analytics_events (id, name, props, created_at) VALUES (?,?,?,?)",
            (new_id("evt"), name, json.dumps(safe), utcnow()),
        )
        self.conn.commit()
        return 200, {"ok": True}

    def ops_list_leads(self, status=None):
        if status:
            rows = self.conn.execute("SELECT * FROM leads WHERE status = ? AND deleted_at IS NULL ORDER BY created_at DESC", (status,)).fetchall()
        else:
            rows = self.conn.execute("SELECT * FROM leads WHERE deleted_at IS NULL ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]

    def ops_set_lead_status(self, lead_id, status):
        if status not in LEAD_STATUSES:
            return 400, {"ok": False, "code": "INVALID_STATUS"}
        row = self.conn.execute("SELECT id FROM leads WHERE id = ? AND deleted_at IS NULL", (lead_id,)).fetchone()
        if not row:
            return 404, {"ok": False, "code": "NOT_FOUND"}
        self.conn.execute("UPDATE leads SET status=?, updated_at=? WHERE id=?", (status, utcnow(), lead_id))
        self.conn.commit()
        self.audit("lead_status", actor="operator", entity_type="lead", entity_id=lead_id, detail=status)
        if status == "contacted":
            self.track_analytics({"name": "operator_contacted", "props": {"leadId": lead_id}})
        if status == "qualified":
            self.track_analytics({"name": "lead_qualified", "props": {"leadId": lead_id, "via": "ops"}})
        return 200, {"ok": True, "id": lead_id, "status": status}

    def ops_list_tickets(self, kind=None):
        if kind:
            rows = self.conn.execute("SELECT * FROM tickets WHERE kind = ? ORDER BY created_at DESC", (kind,)).fetchall()
        else:
            rows = self.conn.execute("SELECT * FROM tickets ORDER BY urgent DESC, created_at DESC").fetchall()
        return [dict(r) for r in rows]

    def ops_set_ticket_status(self, ticket_id, status):
        if status not in TICKET_STATUSES:
            return 400, {"ok": False, "code": "INVALID_STATUS"}
        row = self.conn.execute("SELECT id FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
        if not row:
            return 404, {"ok": False, "code": "NOT_FOUND"}
        self.conn.execute("UPDATE tickets SET status=?, updated_at=? WHERE id=?", (status, utcnow(), ticket_id))
        self.conn.commit()
        self.audit("ticket_status", actor="operator", entity_type="ticket", entity_id=ticket_id, detail=status)
        return 200, {"ok": True, "id": ticket_id, "status": status}

    def _eligible_intro_member(self, member_id):
        if not member_id or not isinstance(member_id, str):
            return False
        row = self.conn.execute("""
            SELECT 1 FROM members m JOIN consents c ON c.member_id=m.id
            JOIN profiles p ON p.member_id=m.id
            WHERE m.id=? AND m.deleted_at IS NULL AND m.email_verified=1
            AND m.is_demo=0 AND c.terms=1 AND c.privacy=1 AND c.withdrawn=0
            AND p.age>=21
            """, (member_id,)).fetchone()
        return bool(row)

    def _pause_member_introductions(self, member_id):
        # This is called before account/consent deletion. Stop invitations
        # immediately; never reuse a previously accepted response.
        self.conn.execute("""
            UPDATE introduction_cases SET status='paused', updated_at=?
            WHERE status IN ('open','mutual','draft')
              AND (member_id=? OR peer_member_id=?)""",
            (utcnow(), member_id, member_id))
        self.conn.execute("""
            DELETE FROM introduction_consents WHERE member_id=?
            OR case_id IN (SELECT id FROM introduction_cases
                           WHERE member_id=? OR peer_member_id=?)
            """, (member_id, member_id, member_id))

    def ops_create_case(self, body):
        if not isinstance(body, dict):
            return 400, {"ok": False, "code": "BAD_REQUEST"}
        first = body.get("memberId")
        second = body.get("peerMemberId")
        if bool(first) != bool(second):
            return 400, {"ok": False, "code": "BOTH_ADULTS_REQUIRED"}
        if first:
            if first == second or not all(self._eligible_intro_member(mid) for mid in (first, second)):
                return 403, {"ok": False, "code": "ELIGIBLE_ADULTS_REQUIRED"}
            if (hasattr(self,"private_features") and self.private_features.is_blocked(first, second)):
                return 403, {"ok": False, "code": "BLOCKED"}
        # An operator-created record is only a draft; never implied consent.
        with self.lock:
            cid = new_id("case")
            reference = "IC-" + secrets.token_hex(3).upper()
            now = utcnow()
            self.conn.execute("""
                INSERT INTO introduction_cases
                (id,reference,lead_id,member_id,peer_member_id,peer_label,status,notes,created_at,updated_at)
                VALUES(?,?,?,?,?,?,'draft',?,?,?)""",
                (cid, reference, body.get("leadId"), first, second,
                 str(body.get("peerLabel") or "")[:80],
                 str(body.get("notes") or "")[:1000], now, now))
            self.conn.commit()
        self.audit("introduction_draft_created", actor="operator", entity_type="introduction", entity_id=cid)
        return 201, {"ok": True, "case": {"id": cid, "reference": reference, "status": "draft"}}

    def _intro_pair(self, row):
        return row and row["member_id"] and row["peer_member_id"] and (
            row["member_id"] != row["peer_member_id"]) and all(
            self._eligible_intro_member(x) for x in (row["member_id"],row["peer_member_id"])) and (
            not hasattr(self,"private_features") or
            not self.private_features.is_blocked(row["member_id"],row["peer_member_id"]))

    def ops_set_case_status(self, case_id, status):
        if status not in CASE_STATUSES:
            return 400, {"ok": False, "code": "INVALID_STATUS"}
        with self.lock:
            row = self.conn.execute("SELECT * FROM introduction_cases WHERE id=?", (case_id,)).fetchone()
            if not row:
                return 404, {"ok": False, "code": "NOT_FOUND"}
            old = row["status"]
            if status in ("open", "mutual"):
                if not self.matchmaking_ready():
                    return 409, {"ok": False, "code": "MATCHMAKING_NOT_LIVE"}
                if not self._intro_pair(row):
                    return 403, {"ok": False, "code": "TWO_VERIFIED_ADULTS_REQUIRED"}
            if status == "open" and old not in ("draft", "open"):
                return 409, {"ok": False, "code": "INVALID_TRANSITION"}
            if status == "mutual":
                if old not in ("open", "mutual"):
                    return 409, {"ok": False, "code": "INVALID_TRANSITION"}
                decisions = self.conn.execute("""
                    SELECT member_id FROM introduction_consents
                    WHERE case_id=? AND decision='accepted' """, (case_id,)).fetchall()
                if {r["member_id"] for r in decisions} != {row["member_id"], row["peer_member_id"]}:
                    return 409, {"ok": False, "code": "BOTH_ADULTS_MUST_ACCEPT"}
            if status == "draft" and old != "draft":
                return 409, {"ok": False, "code": "INVALID_TRANSITION"}
            if old in ("closed", "paused") and status not in ("closed", "paused"):
                return 409, {"ok": False, "code": "NEW_INTRODUCTION_REQUIRED"}
            self.conn.execute("UPDATE introduction_cases SET status=?, updated_at=? WHERE id=?",
                              (status, utcnow(), case_id))
            self.conn.commit()
        self.audit("introduction_status", actor="operator", entity_type="introduction", entity_id=case_id, detail=status)
        return 200, {"ok": True, "id": case_id, "status": status}

    def list_member_introductions(self, member_id):
        if not self.matchmaking_ready():
            return 409, {"ok": False, "code": "MATCHMAKING_NOT_LIVE"}
        if not self._eligible_intro_member(member_id):
            return 403, {"ok": False, "code": "INELIGIBLE"}
        rows = self.conn.execute("""
            SELECT i.id,i.reference,i.status,i.created_at,c.decision
            FROM introduction_cases i LEFT JOIN introduction_consents c
            ON c.case_id=i.id AND c.member_id=?
            WHERE (i.member_id=? OR i.peer_member_id=?)
            AND i.status IN ('open','mutual')
            ORDER BY i.created_at DESC LIMIT 30""",
            (member_id, member_id, member_id)).fetchall()
        # Neither peer identity, profile, location, nor operator notes is
        # exposed before a separately reviewed release of an introduction.
        return 200, {"ok": True, "introductions": [{
            "id":row["id"],"reference":row["reference"],"status":row["status"],
            "myDecision":row["decision"],"createdAt":row["created_at"]
        } for row in rows]}

    def respond_member_introduction(self, member_id, case_id, body):
        if not self.matchmaking_ready():
            return 409, {"ok": False, "code": "MATCHMAKING_NOT_LIVE"}
        if not isinstance(body, dict) or body.get("decision") not in ("accept", "decline"):
            return 400, {"ok": False, "code": "VALIDATION"}
        with self.lock:
            row = self.conn.execute("SELECT * FROM introduction_cases WHERE id=?", (case_id,)).fetchone()
            if not row or member_id not in (row["member_id"],row["peer_member_id"]):
                return 404, {"ok": False, "code": "NOT_FOUND"}
            if row["status"] not in ("open", "mutual") or not self._intro_pair(row):
                return 409, {"ok": False, "code": "INTRODUCTION_UNAVAILABLE"}
            decision = "accepted" if body["decision"] == "accept" else "declined"
            self.conn.execute("""
                INSERT INTO introduction_consents(case_id,member_id,decision,created_at)
                VALUES(?,?,?,?)
                ON CONFLICT(case_id,member_id) DO UPDATE SET
                  decision=excluded.decision, created_at=excluded.created_at
                """, (case_id,member_id,decision,utcnow()))
            if decision == "declined":
                self.conn.execute("UPDATE introduction_cases SET status='paused',updated_at=? WHERE id=?",
                                  (utcnow(),case_id))
            self.conn.commit()
        self.audit("introduction_response", actor=member_id, entity_type="introduction",entity_id=case_id, detail=decision)
        return 200, {"ok": True, "myDecision": decision, "status": "paused" if decision=="declined" else row["status"]}

    def ops_create_verification(self, body):
        vid = new_id("ver")
        reference = "VR-" + secrets.token_hex(3).upper()
        now = utcnow()
        claim = str(body.get("claim") or "").strip()[:200]
        if len(claim) < 5:
            return 400, {"ok": False, "code": "VALIDATION"}
        self.conn.execute(
            "INSERT INTO verification_requests (id, reference, member_id, claim, status, created_at, updated_at) VALUES (?,?,?,?, 'requested', ?, ?)",
            (vid, reference, body.get("memberId"), claim, now, now),
        )
        self.conn.commit()
        return 201, {"ok": True, "request": {"id": vid, "reference": reference, "status": "requested"}}

    def ops_set_verification(self, vid, status, note=""):
        if status not in VERIFY_STATUSES:
            return 400, {"ok": False, "code": "INVALID_STATUS"}
        self.conn.execute(
            "UPDATE verification_requests SET status=?, result_note=?, updated_at=? WHERE id=?",
            (status, str(note)[:500], utcnow(), vid),
        )
        self.conn.commit()
        return 200, {"ok": True, "id": vid, "status": status}

    def ops_create_fulfillment(self, body):
        fid = new_id("ful")
        now = utcnow()
        self.conn.execute(
            "INSERT INTO fulfillment (id, service_id, order_ref, member_id, lead_id, status, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (fid, str(body.get("serviceId") or "")[:80], body.get("orderRef"), body.get("memberId"), body.get("leadId"), "queued", str(body.get("notes") or "")[:500], now, now),
        )
        self.conn.commit()
        return 201, {"ok": True, "fulfillment": {"id": fid, "status": "queued"}}

    def ops_set_fulfillment(self, fid, status):
        if status not in FULFILL_STATUSES:
            return 400, {"ok": False, "code": "INVALID_STATUS"}
        self.conn.execute("UPDATE fulfillment SET status=?, updated_at=? WHERE id=?", (status, utcnow(), fid))
        self.conn.commit()
        if status == "delivered":
            self.conn.execute(
                "INSERT INTO analytics_events (id, name, props, created_at) VALUES (?,?,?,?)",
                (new_id("evt"), "service_fulfilled", json.dumps({"fulfillmentId": fid}), utcnow()),
            )
            self.conn.commit()
        return 200, {"ok": True, "id": fid, "status": status}

    def ops_dashboard(self):
        def count(sql, *args):
            return self.conn.execute(sql, args).fetchone()[0]

        by_status = {s: count("SELECT COUNT(*) FROM leads WHERE status=? AND deleted_at IS NULL", s) for s in LEAD_STATUSES}
        return {
            "mode": "waitlist" if self.conf.get("WAITLIST_MODE", "1") == "1" else "live",
            "matchmakingLive": self.matchmaking_ready(),
            "mailConfigured": self.mailer.configured,
            "operatorEmailConfigured": bool(self.conf.get("OPERATOR_EMAIL")),
            "leads": by_status,
            "ticketsOpen": count("SELECT COUNT(*) FROM tickets WHERE status IN ('new','acknowledged','in_progress')"),
            "safetyOpen": count("SELECT COUNT(*) FROM tickets WHERE kind='safety' AND status IN ('new','acknowledged','in_progress')"),
            "members": count("SELECT COUNT(*) FROM members WHERE deleted_at IS NULL AND is_demo=0"),
            "casesOpen": count("SELECT COUNT(*) FROM introduction_cases WHERE status IN ('open','mutual')"),
            "verificationsOpen": count("SELECT COUNT(*) FROM verification_requests WHERE status IN ('requested','in_review')"),
            "fulfillmentQueued": count("SELECT COUNT(*) FROM fulfillment WHERE status IN ('queued','in_progress')"),
            "notificationsFailed": count("SELECT COUNT(*) FROM notifications WHERE status='failed'"),
            "notificationsQueued": count("SELECT COUNT(*) FROM notifications WHERE status='queued'"),
            "demoMembers": count("SELECT COUNT(*) FROM members WHERE is_demo=1"),
            "payments": "sandbox_only",
            "funnel": self.ops_funnel().get("totals", {}),
        }

    def ops_funnel(self, days=30):
        """Operator funnel. Notifications are not counted as customers or registrations."""
        since = (datetime.now(timezone.utc) - timedelta(days=int(days or 30))).isoformat()
        names = [
            "landing_view", "quiz_started", "quiz_completed", "pledge_completed",
            "signup_started", "signup_completed", "lead_qualified", "operator_contacted",
            "introduction_requested", "introduction_accepted",
            "checkout_started", "payment_confirmed", "service_fulfilled", "refund_completed",
            "waitlist_submitted", "quiz_to_signup", "pledge_to_signup",
        ]
        totals = {}
        for name in names:
            totals[name] = self.conn.execute(
                "SELECT COUNT(*) FROM analytics_events WHERE name = ? AND created_at >= ?",
                (name, since),
            ).fetchone()[0]
        # Cohort by lead source + status (not notifications)
        rows = self.conn.execute(
            "SELECT COALESCE(source,'unknown') AS source, status, COUNT(*) AS n FROM leads WHERE deleted_at IS NULL AND created_at >= ? GROUP BY 1,2 ORDER BY n DESC",
            (since,),
        ).fetchall()
        by_day = self.conn.execute(
            "SELECT substr(created_at,1,10) AS day, COUNT(*) AS leads FROM leads WHERE deleted_at IS NULL AND created_at >= ? GROUP BY 1 ORDER BY 1 DESC LIMIT 60",
            (since,),
        ).fetchall()
        return {
            "ok": True,
            "days": int(days or 30),
            "totals": totals,
            "leadsBySourceStatus": [dict(r) for r in rows],
            "leadsByDay": [dict(r) for r in by_day],
            "membersProduction": self.conn.execute(
                "SELECT COUNT(*) FROM members WHERE deleted_at IS NULL AND is_demo=0 AND created_at >= ?",
                (since,),
            ).fetchone()[0],
            "note": "Notifications and outbox rows are not counted as customers or registrations.",
            "paymentsMode": "sandbox_only",
        }


class Handler(BaseHTTPRequestHandler):
    store: Store = None
    private_features: PrivateFeatures = None
    al_wali: AlWali = None
    wali_limiter = RateLimiter(30, 300)
    wali_ai_limiter = RateLimiter(8, 300)
    wali_global_limiter = RateLimiter(100, 60)
    limiter = RateLimiter(30, 60)
    analytics_limiter = RateLimiter(120, 60)
    analytics_global_limiter = RateLimiter(3000, 60)
    admin_token = ""

    def finish(self):
        try:
            super().finish()
        finally:
            if self.store is not None:
                self.store.close_thread_connection()

    def log_message(self, fmt, *args):
        # Structured access log (JSON) for operators; never log bodies or tokens.
        try:
            msg = {
                "ts": utcnow(),
                "client": self._client(),
                "method": self.command,
                "path": self.path.split("?", 1)[0],
                "status_line": fmt % args,
            }
            print(json.dumps(msg), flush=True)
        except Exception:
            return

    def _client(self):
        peer = self.client_address[0]
        # Forwarded client IPs are usable only from operator-trusted proxies.
        # Never accept a caller-supplied X-Forwarded-For from a direct request.
        networks = (self.store.conf.get("AMANIKAH_TRUSTED_PROXY_CIDRS") or "").split(",")
        try:
            trusted = any(ipaddress.ip_address(peer) in ipaddress.ip_network(net.strip(), strict=False)
                          for net in networks if net.strip())
            if trusted:
                forwarded = (self.headers.get("X-Forwarded-For") or "").split(",")[0].strip()
                if forwarded:
                    return str(ipaddress.ip_address(forwarded))
        except ValueError:
            pass
        return peer

    def _json(self):
        # Invalid/oversized bodies fail closed without throwing an uncaught
        # exception or reading an unlimited socket stream.
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except (TypeError, ValueError, OverflowError):
            return None
        if length < 0 or length > 100000:
            return None
        raw = self.rfile.read(length) if length else b""
        if not raw:
            return {}
        try:
            data = json.loads(raw.decode("utf-8"))
            return data if isinstance(data, dict) else None
        except (UnicodeDecodeError, ValueError):
            return None

    def _send(self, status, body, write_body=True):
        raw = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        if write_body:
            self.wfile.write(raw)

    def _send_html(self, status, html: str, write_body=True):
        raw = html.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        if write_body:
            self.wfile.write(raw)

    def _share_page(self, qs, write_body=True):
        share_id = (qs.get("s") or [None])[0]
        if not share_id:
            return self._send(400, {"ok": False, "code": "MISSING_SHARE_ID"}, write_body)
        status, payload = self.store.get_share(str(share_id))
        site_root = Path(self.store.conf.get("SITE_ROOT") or "/srv/amanikah")
        static_path = site_root / "simple-nikah" / "share.html"
        if status == 200 and static_path.is_file():
            return self._send_html(200, static_path.read_text(encoding="utf-8"), write_body)
        # Revoked / missing: real HTTP 410 (or 404) with a safe static message — no pledge payload in HTML.
        title = "This pledge link is no longer shown" if status == 410 else "Pledge link not found"
        body = (
            "The person who created it revoked this link, or the link is incomplete. "
            "You can still make your own pledge."
            if status == 410
            else "This #SimpleNikah link is unavailable."
        )
        html = f"""<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} — Amanikah</title>
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="This #SimpleNikah link is no longer available.">
<link rel="stylesheet" href="/css/site.css?v=5">
</head><body>
<main class="wrap narrow" style="padding:48px 16px">
<p class="kicker">#SimpleNikah</p>
<h1>{title}</h1>
<p class="quiet">{body}</p>
<p style="margin-top:24px"><a class="btn btn-emerald" href="/simple-nikah/">Make my own pledge</a>
<a class="btn btn-ghost" href="/">Explore Amanikah</a></p>
</main></body></html>"""
        return self._send_html(410 if status == 410 else 404, html, write_body)

    def _admin(self):
        provided = self.headers.get("X-Ops-Token") or self.headers.get("X-Admin-Token") or ""
        return bool(self.admin_token) and hmac.compare_digest(provided, self.admin_token)

    def _bearer(self):
        auth = self.headers.get("Authorization") or ""
        if auth.lower().startswith("bearer "):
            return auth[7:].strip()
        return self.headers.get("X-Session-Token") or ""

    def do_HEAD(self):
        self._route(write_body=False)

    def do_GET(self):
        self._route(write_body=True)

    def do_POST(self):
        self._route(write_body=True, method="POST")

    def do_PATCH(self):
        self._route(write_body=True, method="PATCH")

    def _route(self, write_body=True, method=None):
        method = method or self.command
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        qs = parse_qs(parsed.query)
        store = self.store

        # Authenticated family/voice routes; never publicly expose audio.
        if path.startswith("/api/amanikah/me/family") or path.startswith("/api/amanikah/me/voice"):
            return self.private_features.route(self, method, path, write_body)

        # Public share page: return real HTTP 410 when the unlisted link was revoked.
        if method == "GET" and path == "/simple-nikah/share.html":
            return self._share_page(qs, write_body)

        if path == "/api/amanikah/al-wali/status" and method == "GET":
            return self._send(200, self.al_wali.status(), write_body)

        if path == "/api/amanikah/al-wali/chat" and method == "POST":
            # An optional, text-only public helper: separately rate-limited to manage
            # inference cost and prevent excessive collection of visitor questions.
            if not (self.wali_limiter.allow("wali:" + self._client())
                    and self.wali_global_limiter.allow("all")):
                return self._send(429, {"ok": False, "code": "RATE_LIMITED",
                                        "message": "Please try again later. You can still use our free guides."}, write_body)
            body = self._json()
            if body is None:
                return self._send(400, {"ok": False, "code": "BAD_JSON"}, write_body)
            if (isinstance(body, dict) and body.get("consentToAI") is True
                    and self.al_wali.enabled
                    and not self.wali_ai_limiter.allow("wali-ai:" + self._client())):
                return self._send(429, {"ok": False, "code": "AI_RATE_LIMITED",
                                        "message": "AI limit reached for now. You can still use the free guided questions."},
                                  write_body)
            code, response = self.al_wali.handle(body)
            return self._send(code, response, write_body)

        if path == "/api/amanikah/health":
            return self._send(200, {
                "ok": True,
                "service": "amanikah-api",
                "waitlistMode": store.conf.get("WAITLIST_MODE", "1") == "1",
                "matchmakingLive": store.matchmaking_ready(),
                "mailConfigured": store.mailer.configured,
            }, write_body)

        if method == "POST" and path == "/api/amanikah/leads":
            if not self.limiter.allow("lead:" + self._client()):
                return self._send(429, {"ok": False, "code": "RATE_LIMITED"}, write_body)
            body = self._json()
            if body is None:
                return self._send(400, {"ok": False, "code": "BAD_JSON"}, write_body)
            status, payload = store.create_lead(body, self._client())
            if status < 300:
                store.track_analytics({"name": "waitlist_submitted", "props": {"source": body.get("source")}})
                if body.get("source") in ("quiz", "nikah-readiness"):
                    store.track_analytics({"name": "quiz_to_signup", "props": {"reference": payload.get("reference")}})
                if body.get("source") in ("simple-nikah", "pledge"):
                    store.track_analytics({"name": "pledge_to_signup", "props": {"reference": payload.get("reference")}})
                store.track_analytics({"name": "qualified_signup", "props": {"reference": payload.get("reference")}})
            return self._send(status, payload, write_body)

        if method == "POST" and path == "/api/amanikah/tickets":
            if not self.limiter.allow("ticket:" + self._client()):
                return self._send(429, {"ok": False, "code": "RATE_LIMITED"}, write_body)
            body = self._json()
            if body is None:
                return self._send(400, {"ok": False, "code": "BAD_JSON"}, write_body)
            urgent = str(body.get("kind") or "").lower() == "safety"
            status, payload = store.create_ticket(body, self._client(), urgent=urgent)
            if status < 300:
                store.track_analytics({"name": "safety_submitted" if urgent else "contact_submitted", "props": {"reference": payload.get("reference")}})
            return self._send(status, payload, write_body)

        if method == "POST" and path == "/api/amanikah/auth/register":
            # UI-only disablement is insufficient: the API must also block
            # unusable/unverified registrations during mail-free early access.
            test_only = (store.conf.get("AMANIKAH_ALLOW_OPERATOR_VERIFICATION") == "1"
                         and self.server.server_address[0] in ("127.0.0.1", "::1"))
            if not (store.mailer.configured or test_only):
                return self._send(503, {"ok": False, "code": "REGISTRATION_PAUSED",
                                        "message": "New accounts are paused until secure verification is available."},
                                  write_body)
            if not self.limiter.allow("reg:" + self._client()):
                return self._send(429, {"ok": False, "code": "RATE_LIMITED"}, write_body)
            body = self._json()
            if body is None:
                return self._send(400, {"ok": False, "code": "BAD_JSON"}, write_body)
            status, payload = store.register_member(body)
            return self._send(status, payload, write_body)

        if method == "POST" and path == "/api/amanikah/auth/logout":
            return self._send(*store.logout(self._bearer()), write_body)

        if method == "POST" and path == "/api/amanikah/auth/login":
            if not self.limiter.allow("login:" + self._client()):
                return self._send(429, {"ok": False, "code": "RATE_LIMITED"}, write_body)
            body = self._json()
            if body is None:
                return self._send(400, {"ok": False, "code": "BAD_JSON"}, write_body)
            status, payload = store.login(body)
            return self._send(status, payload, write_body)

        if method == "POST" and path == "/api/amanikah/auth/verify":
            if not self.limiter.allow("verification:" + self._client()):
                return self._send(429, {"ok":False,"code":"RATE_LIMITED"}, write_body)
            body = self._json() or {}
            token = body.get("token") or (qs.get("token") or [None])[0]
            status, payload = store.verify_email(str(token or ""))
            return self._send(status, payload, write_body)

        # Verification is POST-only: URL prefetchers and link crawlers must
        # never consume an email-verification token with a GET.

        if method == "GET" and path == "/api/amanikah/me/introductions":
            member = store.session_member(self._bearer())
            if not member:
                return self._send(401, {"ok":False,"code":"UNAUTHENTICATED"}, write_body)
            return self._send(*store.list_member_introductions(member["id"]), write_body)

        if method == "POST" and path.startswith("/api/amanikah/me/introductions/") and path.endswith("/respond"):
            member = store.session_member(self._bearer())
            if not member:
                return self._send(401, {"ok":False,"code":"UNAUTHENTICATED"}, write_body)
            case_id = path[len("/api/amanikah/me/introductions/"):-len("/respond")].strip("/")
            if not re.fullmatch(r"case_[a-f0-9]{16}", case_id):
                return self._send(404, {"ok":False,"code":"NOT_FOUND"}, write_body)
            return self._send(*store.respond_member_introduction(
                member["id"],case_id,self._json()), write_body)

        if method == "GET" and path == "/api/amanikah/me":
            member = store.session_member(self._bearer())
            if not member:
                return self._send(401, {"ok": False, "code": "UNAUTHENTICATED"}, write_body)
            return self._send(200, {"ok": True, "member": store.public_member(member["id"])}, write_body)

        if method == "PATCH" and path == "/api/amanikah/me/profile":
            member = store.session_member(self._bearer())
            if not member:
                return self._send(401, {"ok": False, "code": "UNAUTHENTICATED"}, write_body)
            body = self._json()
            if body is None:
                return self._send(400, {"ok": False, "code": "BAD_JSON"}, write_body)
            status, payload = store.update_profile(member["id"], body)
            return self._send(status, payload, write_body)

        if method == "POST" and path == "/api/amanikah/me/withdraw-consent":
            member = store.session_member(self._bearer())
            if not member:
                return self._send(401, {"ok": False, "code": "UNAUTHENTICATED"}, write_body)
            status, payload = store.withdraw_consent(member["id"])
            return self._send(status, payload, write_body)

        if method == "POST" and path == "/api/amanikah/me/delete":
            member = store.session_member(self._bearer())
            if not member:
                return self._send(401, {"ok": False, "code": "UNAUTHENTICATED"}, write_body)
            status, payload = store.delete_account(member["id"])
            return self._send(status, payload, write_body)

        if method == "GET" and path.startswith("/api/amanikah/members/"):
            member = store.session_member(self._bearer())
            target = path.split("/")[-1]
            status, payload = store.get_profile_authorized(member, target)
            return self._send(status, payload, write_body)

        if method == "POST" and path == "/api/amanikah/analytics/events":
            if not (self.analytics_limiter.allow("analytics:" + self._client())
                    and self.analytics_global_limiter.allow("all")):
                return self._send(429, {"ok":False,"code":"RATE_LIMITED"}, write_body)
            body = self._json()
            if body is None:
                return self._send(400, {"ok": False, "code": "BAD_JSON"}, write_body)
            status, payload = store.track_analytics(body)
            return self._send(status, payload, write_body)

        if method == "POST" and path == "/api/amanikah/shares":
            if not self.limiter.allow("share:" + self._client()):
                return self._send(429, {"ok": False, "code": "RATE_LIMITED"}, write_body)
            body = self._json()
            if body is None:
                return self._send(400, {"ok": False, "code": "BAD_JSON"}, write_body)
            status, payload = store.create_share(body)
            return self._send(status, payload, write_body)

        if method == "GET" and path.startswith("/api/amanikah/shares/"):
            share_id = path.split("/")[-1]
            status, payload = store.get_share(share_id)
            return self._send(status, payload, write_body)

        if method == "POST" and path.startswith("/api/amanikah/shares/") and path.endswith("/revoke"):
            if not self.limiter.allow("share-revoke:" + self._client()):
                return self._send(429, {"ok":False,"code":"RATE_LIMITED"}, write_body)
            share_id = path.rstrip("/").split("/")[-2]
            body = self._json() or {}
            status, payload = store.revoke_share(share_id, body.get("revokeToken") or body.get("token") or "")
            return self._send(status, payload, write_body)

        # Operator routes
        if path.startswith("/api/amanikah/ops"):
            if not self._admin():
                return self._send(401, {"ok": False, "code": "OPS_UNAUTHORIZED"}, write_body)
            if method == "GET" and path == "/api/amanikah/ops/dashboard":
                return self._send(200, store.ops_dashboard(), write_body)
            if method == "GET" and path == "/api/amanikah/ops/funnel":
                days = (qs.get("days") or ["30"])[0]
                try:
                    days = int(days)
                except Exception:
                    days = 30
                return self._send(200, store.ops_funnel(days), write_body)
            if method == "GET" and path == "/api/amanikah/ops/leads":
                status = (qs.get("status") or [None])[0]
                return self._send(200, {"ok": True, "leads": store.ops_list_leads(status)}, write_body)
            if method == "PATCH" and path.startswith("/api/amanikah/ops/leads/"):
                lead_id = path.split("/")[-1]
                body = self._json() or {}
                status, payload = store.ops_set_lead_status(lead_id, body.get("status"))
                return self._send(status, payload, write_body)
            if method == "GET" and path == "/api/amanikah/ops/tickets":
                kind = (qs.get("kind") or [None])[0]
                return self._send(200, {"ok": True, "tickets": store.ops_list_tickets(kind)}, write_body)
            if method == "PATCH" and path.startswith("/api/amanikah/ops/tickets/"):
                ticket_id = path.split("/")[-1]
                body = self._json() or {}
                status, payload = store.ops_set_ticket_status(ticket_id, body.get("status"))
                return self._send(status, payload, write_body)
            if method == "GET" and path == "/api/amanikah/ops/cases":
                rows = store.conn.execute("SELECT * FROM introduction_cases ORDER BY created_at DESC").fetchall()
                return self._send(200, {"ok": True, "cases": [dict(r) for r in rows]}, write_body)
            if method == "POST" and path == "/api/amanikah/ops/cases":
                body = self._json() or {}
                status, payload = store.ops_create_case(body)
                return self._send(status, payload, write_body)
            if method == "PATCH" and path.startswith("/api/amanikah/ops/cases/"):
                case_id = path.split("/")[-1]
                body = self._json() or {}
                status, payload = store.ops_set_case_status(case_id, body.get("status"))
                return self._send(status, payload, write_body)
            if method == "GET" and path == "/api/amanikah/ops/verifications":
                rows = store.conn.execute("SELECT * FROM verification_requests ORDER BY created_at DESC").fetchall()
                return self._send(200, {"ok": True, "requests": [dict(r) for r in rows]}, write_body)
            if method == "POST" and path == "/api/amanikah/ops/verifications":
                body = self._json() or {}
                status, payload = store.ops_create_verification(body)
                return self._send(status, payload, write_body)
            if method == "PATCH" and path.startswith("/api/amanikah/ops/verifications/"):
                vid = path.split("/")[-1]
                body = self._json() or {}
                status, payload = store.ops_set_verification(vid, body.get("status"), body.get("note") or "")
                return self._send(status, payload, write_body)
            if method == "GET" and path == "/api/amanikah/ops/fulfillment":
                rows = store.conn.execute("SELECT * FROM fulfillment ORDER BY created_at DESC").fetchall()
                return self._send(200, {"ok": True, "items": [dict(r) for r in rows]}, write_body)
            if method == "POST" and path == "/api/amanikah/ops/fulfillment":
                body = self._json() or {}
                status, payload = store.ops_create_fulfillment(body)
                return self._send(status, payload, write_body)
            if method == "PATCH" and path.startswith("/api/amanikah/ops/fulfillment/"):
                fid = path.split("/")[-1]
                body = self._json() or {}
                status, payload = store.ops_set_fulfillment(fid, body.get("status"))
                return self._send(status, payload, write_body)
            if method == "GET" and path == "/api/amanikah/ops/notifications":
                rows = store.conn.execute("SELECT id, channel, destination, subject, status, related_type, related_id, error, created_at, sent_at FROM notifications ORDER BY created_at DESC LIMIT 100").fetchall()
                return self._send(200, {"ok": True, "notifications": [dict(r) for r in rows]}, write_body)
            if method == "GET" and path == "/api/amanikah/ops/members":
                rows = store.conn.execute("SELECT id, email, role, email_verified, is_demo, created_at, deleted_at FROM members ORDER BY created_at DESC").fetchall()
                # Never mix demo into production ops lists as active customers
                return self._send(200, {"ok": True, "members": [dict(r) for r in rows if not r["is_demo"]]}, write_body)
            if method == "GET" and path.startswith("/api/amanikah/ops/notifications/"):
                nid = path.rsplit("/", 1)[-1]
                row = store.conn.execute("SELECT * FROM notifications WHERE id = ?", (nid,)).fetchone()
                if not row:
                    return self._send(404, {"ok": False, "code": "NOT_FOUND"}, write_body)
                return self._send(200, {"ok": True, "notification": dict(row)}, write_body)
            if method == "POST" and path.startswith("/api/amanikah/ops/members/") and path.endswith("/verify-link"):
                mid = path[len("/api/amanikah/ops/members/") : -len("/verify-link")]
                status, payload = store.issue_verify_link(mid)
                return self._send(status, payload, write_body)

        return self._send(404, {"ok": False, "code": "NOT_FOUND"}, write_body)


def load_conf():
    conf = dict(os.environ)
    return conf


def main():
    conf = load_conf()
    pepper = conf.get("SESSION_PEPPER") or ""
    # Never silently rotate a password pepper at restart; that would break
    # all existing logins and create an untraceable recovery incident.
    if len(pepper) < 32 or pepper.startswith("replace-"):
        raise SystemExit("SESSION_PEPPER_NOT_CONFIGURED")
    mailer = Mailer(conf)
    store = Store(conf.get("AMANIKAH_DB", "/data/amanikah.sqlite"), pepper, mailer, conf)
    Handler.store = store
    store.private_features = PrivateFeatures(store)
    Handler.private_features = store.private_features
    Handler.al_wali = AlWali(conf)
    Handler.admin_token = conf.get("OPS_ADMIN_TOKEN") or ""
    if len(Handler.admin_token) < 20 or Handler.admin_token.startswith("replace-"):
        raise SystemExit("OPS_ADMIN_TOKEN_NOT_CONFIGURED")
    host = conf.get("BIND", "0.0.0.0")
    port = int(conf.get("PORT", "8090"))
    server = ThreadingHTTPServer((host, port), Handler)
    server.serve_forever()


if __name__ == "__main__":
    main()
