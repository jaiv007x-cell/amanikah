# Amanikah — Production Reconciliation & Live Funnel Audit

**Date:** 15 November 2026  
**Verified signup URL:** https://amanikah.com/signup.html  
**Commercial launch:** **NO-GO**

---

## 1. Root cause of the discrepancy

| Source | What it shows | Reality |
|---|---|---|
| **Live deploy** `/var/www/amanikah` → Caddy `/srv/amanikah` | Waitlist + `platform.js` → `/api/amanikah/*` | **Authoritative** |
| **Old archives** `/root/Amanikah_Production_Grade.zip`, `Amanikah_VPS_Ready.zip` (built earlier 15 Nov ~11:30–11:52) | Browser-only signup/contact/privacy copy | **Stale snapshot**, not what Caddy serves |
| **Browser/CDN cache** | May show old HTML if client cached | Live etag/checksums match `/var/www` today |

**Conclusion:** Public findings that “signup stays in the browser / no account database” describe the **old ZIP / prior revision**, not the current reverse-proxied site. Live file MD5s equal curl bodies for `signup.html`, `contact.html`, `safety.html`, `privacy.html`.

Fresh archive of live tree: `/root/Amanikah_Live_Reconciled.tar.gz`

---

## 2. Route → handler map (real data flows)

| Public route | Handler | Data store | Operator surface |
|---|---|---|---|
| `GET /`, marketing pages | Caddy `file_server` `/srv/amanikah` | static | — |
| `POST /api/amanikah/leads` | `amanikah-api:8090` | SQLite `leads` | `/ops/` leads + outbox |
| `POST /api/amanikah/tickets` | amanikah-api | SQLite `tickets` | `/ops/` tickets |
| `POST /api/amanikah/auth/*` | amanikah-api | `members`/`sessions` | `/ops/` members |
| `POST /api/amanikah/shares*` | amanikah-api | `shares` | revoke → 410 |
| `POST /api/amanikah/analytics/events` | amanikah-api | `analytics_events` | `/ops/` funnel |
| `GET /api/amanikah/ops/*` | amanikah-api + `X-Ops-Token` | same DB | `/ops/` |
| `/api/billing/*` | `amanikah-billing:8080` | billing SQLite | sandbox only |
| `/register`,`/login`,`/dashboard`,… | Caddy rewrite → `/app/index.html` | **browser localStorage DEMO** | not production |
| `/account/*` | static + platform API | production DB | — |
| `/signup.html` | static + `/js/platform.js` | → leads API | waitlist |
| `/contact.html`,`/safety.html` | platform.js | → tickets API | support / safety |

Caddy (`/root/L/deploy/Caddyfile`): `amanikah.com` root `/srv/amanikah`; `/api/amanikah*` → `amanikah-api:8090`; `/api/billing*` → `amanikah-billing:8080`.

---

## 3. Fixes implemented this pass

| Area | Change |
|---|---|
| Notification privacy | Email body/subject previews **omit** matrimonial notes/message bodies; point operator to `/ops/` |
| Funnel analytics | Events: landing_view, quiz_*, pledge_*, signup_*, lead_qualified, operator_contacted, intro/checkout/payment/fulfill/refund; `GET /api/amanikah/ops/funnel` |
| Ops UI | Funnel panel in `/ops/` (cohort by source/status/day; notifications ≠ customers) |
| Terms / privacy / help | Aligned with waitlist API, production accounts, sandbox billing; AirRates refs removed from privacy |
| Quiz/pledge JS | First-party funnel POSTs for allowlisted events (no private fields) |
| Live archive | `Amanikah_Live_Reconciled.tar.gz` from current `/var/www/amanikah` |

Tasks 2–3 (signup/contact/safety → API) were **already live** before this pass; re-verified by checksum + E2E.

---

## 4. Notification delivery (Task 4)

Inspected `/root/amanikah-api/ops.env` **without printing secrets**:

| Setting | Status |
|---|---|
| `OPERATOR_EMAIL` | **MISSING** |
| `RESEND_API_KEY` | **MISSING** |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | **MISSING** |
| `SMTP_PORT` / `SMTP_TLS` / `MAIL_FROM` | present (defaults) |
| **MAIL_DELIVERY_READY** | **False** |

**Operator notification behavior (verified):** submissions create outbox rows (`stored: true`); `email.sent: false` with `NO_OPERATOR_EMAIL`; messages are **not** shown as emailed. Full content remains in DB/`/ops/`.

**Redaction check (verified):** matrimonial note text does **not** appear in notification `subject` or `body` preview (`SECRET_IN_EMAIL_BODY False`). Body is limited to reference, coarse city, source, and a pointer to `/ops/`.

**To enable email (no invented credentials):** set `OPERATOR_EMAIL` and either `RESEND_API_KEY` + verified `MAIL_FROM`, or SMTP host/user/pass; then `docker compose -f /root/amanikah-api/docker-compose.yml up -d --force-recreate`.

---

## 5. Membership reconciliation (Task 5)

| Path | Mode |
|---|---|
| `/account/register.html` | **Production** — verified CTA on homepage |
| `/register` | **DEMO** — isolated localStorage; not migrated |

Sessions, ACL, deletion, consent: covered by `platform_e2e_test` + reconciliation suite.

---

## 6. Tests executed

| Test | Result |
|---|---|
| `reconciliation_e2e_test.py` | **PASS** |
| `platform_e2e_test.py` | **PASS** |
| Lead → ops visibility | **PASS** (reference returned + listed) |
| Contact + safety tickets | **PASS** |
| Unauthorized member access | **PASS** (401) |
| Funnel endpoint | **PASS** |
| Sandbox ≠ revenue (`payments: sandbox_only`) | **PASS** |
| Demo vs production labeling | **PASS** |
| Real mailbox delivery | **NOT TESTED** (credentials missing) |
| Live payments / matching / verification services | **NOT ENABLED** (gates unchanged) |

Screenshots (redacted UI only): `/root/amanikah-site/tests/playwright/qa-artifacts/recon/`

---

## 7. Remaining configuration requirements

1. `OPERATOR_EMAIL` + Resend **or** SMTP (required for real mailbox delivery).  
2. Confirm legal retention windows (flagged in privacy/terms).  
3. Do **not** enable `MATCHMAKING_LIVE` or live Razorpay until fulfillment/safety gates pass.  
4. Discard or clearly label old ZIPs as obsolete vs `Amanikah_Live_Reconciled.tar.gz`.

---

## 8. Go / No-Go

**NO-GO for commercial launch.**

Reasons: operator email unconfigured; matchmaking off; billing sandbox; no live fulfillment.  

**GO for continued public waitlist** with current honest labeling: https://amanikah.com/signup.html writes real leads to production SQLite and `/ops/`.
