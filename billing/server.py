#!/usr/bin/env python3
"""Amanikah billing. Sandbox until Razorpay keys exist. Never stores card data."""
import hashlib
import hmac
import json
import os
import sqlite3
import threading
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

CARD_KEYS = {
    "card", "card_number", "cardnumber", "cvv", "cvc", "pan",
    "expiry", "exp_month", "exp_year", "name_on_card",
}
EVENTS = {
    "qualified_signup",
    "pricing_viewed",
    "checkout_started",
    "purchase_completed",
    "refund_requested",
    "service_fulfilled",
    "contribution_margin",
}


def utcnow():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def sign_body(secret, raw):
    return hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()


def contains_card(value):
    if isinstance(value, dict):
        for key, item in value.items():
            if str(key).lower() in CARD_KEYS or contains_card(item):
                return True
        return False
    if isinstance(value, list):
        return any(contains_card(item) for item in value)
    if isinstance(value, str) and value.replace(" ", "").isdigit() and len(value.replace(" ", "")) in (13, 14, 15, 16, 19):
        return True
    return False


class Billing:
    def __init__(self, db_path, catalog_path, secret, live=False):
        self.secret = secret
        self.catalog = json.loads(Path(catalog_path).read_text(encoding="utf-8"))
        self.live = bool(live) and self.razorpay_configured()
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self._migrate()

    def razorpay_configured(self):
        return all(os.environ.get(name) for name in (
            "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"
        ))

    def _migrate(self):
        self.conn.executescript("""
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          buyer_id TEXT NOT NULL,
          service_id TEXT NOT NULL,
          amount_paise INTEGER NOT NULL,
          currency TEXT NOT NULL,
          status TEXT NOT NULL,
          reference_name TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS payments (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          status TEXT NOT NULL,
          amount_paise INTEGER NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS webhook_events (
          event_id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          order_id TEXT,
          outcome TEXT NOT NULL,
          received_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS refunds (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          amount_paise INTEGER NOT NULL,
          status TEXT NOT NULL,
          reason TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS invoices (
          id TEXT PRIMARY KEY,
          order_id TEXT UNIQUE NOT NULL,
          number TEXT NOT NULL,
          amount_paise INTEGER NOT NULL,
          issued_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS fulfillments (
          order_id TEXT PRIMARY KEY,
          cost_paise INTEGER NOT NULL,
          fulfilled_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS analytics_events (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          order_id TEXT,
          buyer_id TEXT,
          amount_paise INTEGER,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS audit_log (
          id TEXT PRIMARY KEY,
          action TEXT NOT NULL,
          actor TEXT,
          order_id TEXT,
          detail TEXT,
          created_at TEXT NOT NULL
        );
        """)
        self.conn.commit()

    def audit(self, action, actor=None, order_id=None, detail=None):
        self.conn.execute(
            "INSERT INTO audit_log (id, action, actor, order_id, detail, created_at) VALUES (?,?,?,?,?,?)",
            (uuid.uuid4().hex, action, actor, order_id, detail, utcnow()),
        )
        self.conn.commit()

    def service(self, service_id):
        for row in self.catalog["services"]:
            if row["id"] == service_id:
                return row
        return None

    def status(self):
        return {
            "provider": "razorpay",
            "configured": self.razorpay_configured(),
            "mode": "live" if self.live else "sandbox",
            "live": self.live,
            "cardDataAccepted": False,
            "airratesPaymentsUsed": False,
            "message": (
                "Razorpay Checkout can start because keys are configured."
                if self.live else
                "Razorpay is not configured. Checkout runs in sandbox and does not charge a card."
            ),
        }

    def catalog_public(self):
        body = dict(self.catalog)
        body["payment"] = self.status()
        return body

    def track(self, name, order_id=None, buyer_id=None, amount_paise=None):
        if name not in EVENTS:
            return {"ok": False, "code": "UNKNOWN_EVENT"}
        self.conn.execute(
            "INSERT INTO analytics_events (id, name, order_id, buyer_id, amount_paise, created_at) VALUES (?,?,?,?,?,?)",
            (uuid.uuid4().hex, name, order_id, buyer_id, amount_paise, utcnow()),
        )
        self.conn.commit()
        return {"ok": True, "name": name}

    def create_order(self, buyer_id, body):
        if contains_card(body):
            return 400, {"ok": False, "code": "CARD_NOT_ACCEPTED", "message": "Card details are not accepted here."}
        service_id = body.get("serviceId")
        service = self.service(service_id)
        if not service:
            return 404, {"ok": False, "code": "UNKNOWN_SERVICE"}
        if service.get("pricePaise", 0) <= 0:
            return 400, {"ok": False, "code": "UNPRICED"}
        name = str(body.get("referenceName") or "").strip()[:80]
        order_id = "ord_" + uuid.uuid4().hex[:16]
        now = utcnow()
        self.conn.execute(
            "INSERT INTO orders (id, buyer_id, service_id, amount_paise, currency, status, reference_name, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (order_id, buyer_id, service_id, service["pricePaise"], self.catalog["currency"], "created", name, now, now),
        )
        self.conn.commit()
        self.track("checkout_started", order_id, buyer_id, service["pricePaise"])
        self.audit("order_created", actor=buyer_id, order_id=order_id, detail=service_id)
        return 201, {"ok": True, "order": self.order_view(order_id), "payment": self.status()}

    def order_view(self, order_id):
        row = self.conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
        if not row:
            return None
        service = self.service(row["service_id"])
        invoice = self.conn.execute("SELECT number, amount_paise, issued_at FROM invoices WHERE order_id = ?", (order_id,)).fetchone()
        refunds = self.conn.execute("SELECT id, amount_paise, status, reason, created_at FROM refunds WHERE order_id = ?", (order_id,)).fetchall()
        paid = self.conn.execute("SELECT id, status, amount_paise, created_at FROM payments WHERE order_id = ? ORDER BY created_at", (order_id,)).fetchall()
        return {
            "id": row["id"],
            "serviceId": row["service_id"],
            "serviceName": service["name"] if service else row["service_id"],
            "amountPaise": row["amount_paise"],
            "currency": row["currency"],
            "status": row["status"],
            "referenceName": row["reference_name"],
            "createdAt": row["created_at"],
            "mode": "sandbox" if not self.live else "live",
            "payments": [dict(item) for item in paid],
            "refunds": [dict(item) for item in refunds],
            "invoice": dict(invoice) if invoice else None,
        }

    def orders_for(self, buyer_id):
        rows = self.conn.execute("SELECT id FROM orders WHERE buyer_id = ? ORDER BY created_at DESC", (buyer_id,)).fetchall()
        return [self.order_view(row["id"]) for row in rows]

    def sandbox_event(self, order_id, outcome):
        if self.live:
            return 409, {"ok": False, "code": "SANDBOX_DISABLED"}
        order = self.conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
        if not order:
            return 404, {"ok": False, "code": "NOT_FOUND"}
        if contains_card({"outcome": outcome}):
            return 400, {"ok": False, "code": "CARD_NOT_ACCEPTED"}
        event_type = "payment.captured" if outcome == "captured" else "payment.failed"
        payment_id = "pay_sandbox_" + uuid.uuid4().hex[:12]
        event_id = "evt_sandbox_" + uuid.uuid4().hex[:12]
        payload = {
            "event_id": event_id,
            "event": event_type,
            "payload": {"payment": {"entity": {
                "id": payment_id,
                "order_id": order_id,
                "amount": order["amount_paise"],
                "status": "captured" if outcome == "captured" else "failed",
            }}},
        }
        raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        return self.process_webhook(raw, sign_body(self.secret, raw))

    def process_webhook(self, raw, signature):
        expected = sign_body(self.secret, raw)
        if not signature or not hmac.compare_digest(expected, signature):
            return 400, {"ok": False, "code": "INVALID_SIGNATURE"}
        try:
            data = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            return 400, {"ok": False, "code": "BAD_JSON"}
        event_id = data.get("event_id")
        event_type = data.get("event")
        if not event_id or not event_type:
            return 400, {"ok": False, "code": "EVENT_ID_REQUIRED"}
        try:
            self.conn.execute(
                "INSERT INTO webhook_events (event_id, event_type, order_id, outcome, received_at) VALUES (?,?,?,?,?)",
                (event_id, event_type, None, "received", utcnow()),
            )
        except sqlite3.IntegrityError:
            return 200, {"ok": True, "status": "duplicate", "eventId": event_id}
        entity = (((data.get("payload") or {}).get("payment") or {}).get("entity") or {})
        if event_type == "refund.processed":
            entity = (((data.get("payload") or {}).get("refund") or {}).get("entity") or {})
        order_id = entity.get("order_id")
        outcome = self._apply_event(event_type, entity)
        self.conn.execute(
            "UPDATE webhook_events SET order_id = ?, outcome = ? WHERE event_id = ?",
            (order_id, outcome, event_id),
        )
        self.conn.commit()
        return 200, {"ok": True, "status": outcome, "eventId": event_id, "order": self.order_view(order_id) if order_id else None}

    def _apply_event(self, event_type, entity):
        order_id = entity.get("order_id")
        order = self.conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
        if not order:
            return "ignored"
        now = utcnow()
        if event_type == "payment.captured":
            if order["status"] in ("paid", "fulfilled", "refunded"):
                return "ignored"
            self.conn.execute(
                "INSERT INTO payments (id, order_id, status, amount_paise, created_at) VALUES (?,?,?,?,?)",
                (entity.get("id") or uuid.uuid4().hex, order_id, "captured", order["amount_paise"], now),
            )
            number = "INV-SBX-%04d" % (self.conn.execute("SELECT COUNT(*) AS n FROM invoices").fetchone()["n"] + 1)
            self.conn.execute(
                "INSERT INTO invoices (id, order_id, number, amount_paise, issued_at) VALUES (?,?,?,?,?)",
                (uuid.uuid4().hex, order_id, number, order["amount_paise"], now),
            )
            self.conn.execute("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?", ("paid", now, order_id))
            self.track("purchase_completed", order_id, order["buyer_id"], order["amount_paise"])
            return "captured"
        if event_type == "payment.failed":
            if order["status"] == "created":
                self.conn.execute(
                    "INSERT INTO payments (id, order_id, status, amount_paise, created_at) VALUES (?,?,?,?,?)",
                    (entity.get("id") or uuid.uuid4().hex, order_id, "failed", order["amount_paise"], now),
                )
                self.conn.execute("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?", ("failed", now, order_id))
            return "failed"
        if event_type == "refund.processed":
            amount = int(entity.get("amount") or 0)
            self.conn.execute(
                "INSERT INTO refunds (id, order_id, amount_paise, status, reason, created_at) VALUES (?,?,?,?,?,?)",
                (entity.get("id") or uuid.uuid4().hex, order_id, amount, "processed", entity.get("reason") or "reversal", now),
            )
            self.conn.execute("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?", ("refunded", now, order_id))
            return "refunded"
        return "ignored"

    def request_refund(self, buyer_id, order_id, reason):
        if contains_card({"reason": reason}):
            return 400, {"ok": False, "code": "CARD_NOT_ACCEPTED"}
        order = self.conn.execute("SELECT * FROM orders WHERE id = ? AND buyer_id = ?", (order_id, buyer_id)).fetchone()
        if not order:
            return 404, {"ok": False, "code": "NOT_FOUND"}
        if order["status"] not in ("paid", "fulfilled"):
            return 409, {"ok": False, "code": "NOT_REFUNDABLE", "message": "Only a paid order can be reversed."}
        text = str(reason or "").strip()
        if len(text) < 3:
            return 400, {"ok": False, "code": "REASON_REQUIRED"}
        self.track("refund_requested", order_id, buyer_id, order["amount_paise"])
        if self.live:
            self.conn.execute("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?", ("refund_pending", utcnow(), order_id))
            self.conn.commit()
            return 202, {"ok": True, "status": "refund_pending", "message": "Waiting for the provider refund webhook."}
        event = {
            "event_id": "evt_refund_" + uuid.uuid4().hex[:12],
            "event": "refund.processed",
            "payload": {"refund": {"entity": {
                "id": "rfnd_sandbox_" + uuid.uuid4().hex[:10],
                "order_id": order_id,
                "amount": order["amount_paise"],
                "reason": text,
            }}},
        }
        raw = json.dumps(event, separators=(",", ":")).encode("utf-8")
        status, body = self.process_webhook(raw, sign_body(self.secret, raw))
        return status, body

    def fulfill(self, order_id):
        order = self.conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
        if not order:
            return 404, {"ok": False, "code": "NOT_FOUND"}
        if order["status"] != "paid":
            return 409, {"ok": False, "code": "NOT_PAID"}
        service = self.service(order["service_id"])
        cost = int(service.get("fulfillmentCostPaise") or 0)
        now = utcnow()
        try:
            self.conn.execute(
                "INSERT INTO fulfillments (order_id, cost_paise, fulfilled_at) VALUES (?,?,?)",
                (order_id, cost, now),
            )
        except sqlite3.IntegrityError:
            return 409, {"ok": False, "code": "ALREADY_FULFILLED"}
        self.conn.execute("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?", ("fulfilled", now, order_id))
        margin = order["amount_paise"] - cost
        self.track("service_fulfilled", order_id, order["buyer_id"], order["amount_paise"])
        self.track("contribution_margin", order_id, order["buyer_id"], margin)
        self.audit("service_fulfilled", actor="admin", order_id=order_id, detail=str(margin))
        self.conn.commit()
        return 200, {"ok": True, "order": self.order_view(order_id), "contributionMarginPaise": margin}

    def invoice(self, buyer_id, order_id):
        order = self.conn.execute("SELECT * FROM orders WHERE id = ? AND buyer_id = ?", (order_id, buyer_id)).fetchone()
        if not order:
            return 404, {"ok": False, "code": "NOT_FOUND"}
        row = self.conn.execute("SELECT * FROM invoices WHERE order_id = ?", (order_id,)).fetchone()
        if not row:
            return 404, {"ok": False, "code": "NO_INVOICE", "message": "An invoice is issued only after a captured payment."}
        service = self.service(order["service_id"])
        return 200, {
            "ok": True,
            "invoice": {
                "number": row["number"],
                "orderId": order_id,
                "serviceName": service["name"] if service else order["service_id"],
                "amountPaise": row["amount_paise"],
                "currency": order["currency"],
                "issuedAt": row["issued_at"],
                "mode": "sandbox" if not self.live else "live",
                "taxInvoice": False,
                "note": "Sandbox invoice. Not a tax invoice and not proof of a bank charge.",
            },
        }

    def dashboard(self):
        captured = self.conn.execute("SELECT COALESCE(SUM(amount_paise), 0) AS n FROM payments WHERE status = 'captured'").fetchone()["n"]
        refunded = self.conn.execute("SELECT COALESCE(SUM(amount_paise), 0) AS n FROM refunds WHERE status = 'processed'").fetchone()["n"]
        cost = self.conn.execute("SELECT COALESCE(SUM(cost_paise), 0) AS n FROM fulfillments").fetchone()["n"]
        counts = {}
        for name in EVENTS:
            counts[name] = self.conn.execute("SELECT COUNT(*) AS n FROM analytics_events WHERE name = ?", (name,)).fetchone()["n"]
        started = counts["checkout_started"]
        purchased = counts["purchase_completed"]
        revenue = captured - refunded
        return {
            "mode": "sandbox" if not self.live else "live",
            "live": self.live,
            "label": "Recorded sandbox activity only. Not production revenue." if not self.live else "Live provider totals.",
            "currency": self.catalog["currency"],
            "revenuePaise": revenue,
            "fulfillmentCostPaise": cost,
            "refundsPaise": refunded,
            "contributionMarginPaise": revenue - cost,
            "counts": counts,
            "conversion": None if started == 0 else {"purchases": purchased, "checkouts": started, "rate": purchased / started},
            "orders": self.conn.execute("SELECT COUNT(*) AS n FROM orders").fetchone()["n"],
        }


class RateLimiter:
    def __init__(self, limit=30, window=60):
        self.limit = limit
        self.window = window
        self.hits = defaultdict(deque)
        self.lock = threading.Lock()

    def allow(self, key):
        now = time.time()
        with self.lock:
            bucket = self.hits[key]
            while bucket and now - bucket[0] > self.window:
                bucket.popleft()
            if len(bucket) >= self.limit:
                return False
            bucket.append(now)
            return True


class Handler(BaseHTTPRequestHandler):
    billing = None
    limiter = RateLimiter(limit=40, window=60)
    admin_token = os.environ.get("BILLING_ADMIN_TOKEN", "")

    def log_message(self, fmt, *args):
        return

    def _client(self):
        return self.headers.get("X-Forwarded-For", self.client_address[0]).split(",")[0].strip()

    def _buyer(self):
        buyer = self.headers.get("X-Buyer-Id", "")
        if not buyer or len(buyer) < 8 or len(buyer) > 64:
            return None
        return buyer

    def _admin_ok(self):
        token = self.admin_token
        if not token:
            return not self.billing.live
        provided = self.headers.get("X-Admin-Token", "")
        return bool(provided) and hmac.compare_digest(provided, token)

    def _read(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > 100000:
            return None
        raw = self.rfile.read(length) if length else b""
        if not raw:
            return {}
        try:
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            return None

    def _send(self, status, body, write_body=True):
        raw = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        if write_body:
            self.wfile.write(raw)

    def do_HEAD(self):
        self._dispatch(write_body=False)

    def do_GET(self):
        self._dispatch(write_body=True)

    def _dispatch(self, write_body=True):
        path = urlparse(self.path).path.rstrip("/") or "/"
        bill = self.billing
        if path == "/api/billing/health":
            return self._send(200, {"ok": True, "mode": bill.status()["mode"]}, write_body)
        if path == "/api/billing/catalog":
            return self._send(200, bill.catalog_public(), write_body)
        if path == "/api/billing/dashboard":
            if not self._admin_ok():
                return self._send(401, {"ok": False, "code": "ADMIN_REQUIRED"}, write_body)
            return self._send(200, bill.dashboard(), write_body)
        if path == "/api/billing/orders":
            buyer = self._buyer()
            if not buyer:
                return self._send(401, {"ok": False, "code": "BUYER_REQUIRED"}, write_body)
            return self._send(200, {"ok": True, "orders": bill.orders_for(buyer), "mode": bill.status()["mode"]}, write_body)
        if path.startswith("/api/billing/orders/") and path.endswith("/invoice"):
            buyer = self._buyer()
            order_id = path.split("/")[4]
            if not buyer:
                return self._send(401, {"ok": False, "code": "BUYER_REQUIRED"}, write_body)
            status, body = bill.invoice(buyer, order_id)
            return self._send(status, body, write_body)
        if path.startswith("/api/billing/orders/"):
            buyer = self._buyer()
            order_id = path.split("/")[4]
            view = bill.order_view(order_id)
            if not view:
                return self._send(404, {"ok": False, "code": "NOT_FOUND"}, write_body)
            row = bill.conn.execute("SELECT buyer_id FROM orders WHERE id = ?", (order_id,)).fetchone()
            if not buyer or row["buyer_id"] != buyer:
                return self._send(403, {"ok": False, "code": "FORBIDDEN"}, write_body)
            return self._send(200, {"ok": True, "order": view}, write_body)
        return self._send(404, {"ok": False, "code": "NOT_FOUND"}, write_body)

    def do_POST(self):
        path = urlparse(self.path).path.rstrip("/")
        bill = self.billing
        client = self._client()
        if path == "/api/billing/webhooks/razorpay":
            if not self.limiter.allow("wh:" + client):
                return self._send(429, {"ok": False, "code": "RATE_LIMITED"})
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length else b""
            status, body = bill.process_webhook(raw, self.headers.get("X-Razorpay-Signature", ""))
            bill.audit("webhook", actor=client, order_id=(body.get("order") or {}).get("id") if isinstance(body.get("order"), dict) else None, detail=body.get("status"))
            return self._send(status, body)
        if not self.limiter.allow("post:" + client):
            return self._send(429, {"ok": False, "code": "RATE_LIMITED"})
        body = self._read()
        if body is None:
            return self._send(400, {"ok": False, "code": "BAD_JSON"})
        if contains_card(body):
            return self._send(400, {"ok": False, "code": "CARD_NOT_ACCEPTED", "message": "Card details are not accepted here."})
        if path == "/api/billing/events":
            result = bill.track(body.get("name"), buyer_id=self._buyer())
            return self._send(200 if result.get("ok") else 400, result)
        buyer = self._buyer()
        if path == "/api/billing/orders":
            if not buyer:
                return self._send(401, {"ok": False, "code": "BUYER_REQUIRED"})
            status, payload = bill.create_order(buyer, body)
            return self._send(status, payload)
        if path == "/api/billing/sandbox/payments":
            if bill.live:
                return self._send(409, {"ok": False, "code": "SANDBOX_DISABLED"})
            status, payload = bill.sandbox_event(body.get("orderId"), body.get("outcome"))
            return self._send(status, payload)
        if path.endswith("/refund") and path.startswith("/api/billing/orders/"):
            if not buyer:
                return self._send(401, {"ok": False, "code": "BUYER_REQUIRED"})
            order_id = path.split("/")[4]
            status, payload = bill.request_refund(buyer, order_id, body.get("reason"))
            bill.audit("refund_requested", actor=buyer, order_id=order_id)
            return self._send(status, payload)
        if path.endswith("/fulfill") and path.startswith("/api/billing/orders/"):
            if not self._admin_ok():
                return self._send(401, {"ok": False, "code": "ADMIN_REQUIRED"})
            order_id = path.split("/")[4]
            status, payload = bill.fulfill(order_id)
            return self._send(status, payload)
        return self._send(404, {"ok": False, "code": "NOT_FOUND"})


def serve(host, port, billing):
    Handler.billing = billing
    server = ThreadingHTTPServer((host, port), Handler)
    server.serve_forever()


if __name__ == "__main__":
    secret = os.environ.get("SANDBOX_WEBHOOK_SECRET") or Path(os.environ.get("SANDBOX_SECRET_FILE", "/run/sandbox.secret")).read_text(encoding="utf-8").strip()
    live = os.environ.get("BILLING_MODE") == "live"
    billing = Billing(
        os.environ.get("BILLING_DB", "/data/billing.sqlite"),
        os.environ.get("BILLING_CATALOG", "/config/services.json"),
        secret,
        live=live,
    )
    serve(os.environ.get("BIND", "0.0.0.0"), int(os.environ.get("PORT", "8080")), billing)
