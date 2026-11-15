# Amanikah production-gap report

Date: 2026-11-15  
Verdict: **NOT production-ready for live matchmaking or live payments.** Core lead/contact/safety/membership foundations are implemented and covered by automated tests when the API is deployed.

## What was fixed

| Gap | Status |
|---|---|
| A. Lead capture (browser-only) | Replaced with `POST /api/amanikah/leads` → SQLite, reference, ops statuses, outbox email, honeypot + rate limit, waitlist UX |
| B. Contact / safety | `POST /api/amanikah/tickets` with `support` vs `safety`; success only on 201; emergency guidance; audit + notifications |
| C. Membership foundation | Production auth at `/account/*` with verified email, RBAC roles, profile edit, consent withdraw, delete; demo `/register` untouched |
| D. Operator console | `/ops/` + `/api/amanikah/ops/*` — leads pipeline, cases, verifications, fulfillment |
| E. Payments | Unchanged sandbox billing; dashboard reports `sandbox_only`; live pay not enabled |
| F. Analytics | Consented quiz/pledge sources map to `quiz_to_signup` / `pledge_to_signup`; private profile fields stripped |

## Remaining blockers for “production ready”

1. Configure `OPERATOR_EMAIL` + Resend or SMTP (see `/root/amanikah-api/CONFIG.md`). Until then notifications stay in the outbox (`queued`) — accepted, not emailed.
2. Matchmaking is intentionally off (`MATCHMAKING_LIVE=0`, `WAITLIST_MODE=1`).
3. Live Razorpay / real fulfillment must stay off until services are deliverable.
4. Phone verification not implemented yet (email verification is).
5. Public marketing still describes some future services; waitlist/safety/contact copy is honest.

## Config steps

See `/root/amanikah-api/CONFIG.md`.

## Tests

```bash
python3 /root/amanikah-site/tests/platform_e2e_test.py
```

Do not claim production readiness until that suite prints `PASS` and operator email delivery is verified with a real provider.
