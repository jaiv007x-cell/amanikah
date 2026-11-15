# Amanikah production-readiness audit

Date: 15 November 2026  
Verdict: **NO-GO for production release** (matchmaking and live payments still off)

Lead/contact/safety capture and production membership foundations are now live against `amanikah-api` (see `PRODUCTION_GAP_REPORT.md`). Billing and the demo SPA remain sandbox. AirRates was not used for matrimonial data.

## Fixed in this audit

| Area | Fix |
| --- | --- |
| Billing HEAD | `/api/billing/*` no longer returns HTTP 501 on HEAD |
| Billing security | Rate limits on POST/webhooks; audit log on order/refund/fulfill/webhook; fulfill and dashboard require admin token when `BILLING_ADMIN_TOKEN` is set (sandbox without token still allows local ops) |
| Security headers | HSTS, CSP, Permissions-Policy on amanikah.com |
| Navigation | Marketing pages now link to `/pricing/` instead of `/#pricing` |
| SEO | Homepage JSON-LD Organization; robots.txt disallows private SPA/API/checkout paths |
| Images | Hero JPEG recompressed (~111 KB); WebP (~62 KB) via `<picture>` |
| Deep links | Stub `/.well-known/apple-app-site-association` and empty `assetlinks.json`; `/open/` web fallback |
| Analytics consent | Network beacons require `amanikah.analytics.consent=1`; banner only if an endpoint is configured |
| Accessibility | Membership skip link; Escape closes mobile nav (existing); 320px button stacking |
| Tests | `production_audit_test.py` covers headers/SEO/links and journeys A–H where automated |

## Test results (actually run)

| Suite | Result |
| --- | --- |
| `smoke.py` | ok (18 pages) |
| `simple_nikah_smoke.py` | ok |
| `nikah_readiness_smoke.py` | ok |
| `membership_acl_test.py` | ok (DEMO MODE noted) |
| `family_assistant_test.py` | ok |
| `voice_rishta_test.py` | ok |
| `billing_test.py` | ok (sandbox; Razorpay not configured) |
| `production_audit_test.py` | ok |
| `platform_e2e_test.py` | PASS (leads, tickets, auth ACL, ops, consent) |
| Mobile `node --test src/*.test.js` | 11 pass |
| Responsive overflow at 320 / 375 / 768 / 1024 / 1440 on homepage | 0 horizontal overflow (browser measure) |
| Pricing at 320px | Catalog loads; overflow 0 |
| AirRates after Caddy recreate | HTTP 200 |
| Lighthouse / Core Web Vitals | **Not measured** (no completed Lighthouse run in this audit) |
| Android/iOS device install | **Not run** (no device attached; iOS not buildable on this host) |
| App Store / Play submission | **Not done** |

## Journey coverage

| Path | Status |
| --- | --- |
| A Quiz → results → signup | Automated event/form checks pass; browser signup still demo/local |
| B SimpleNikah → share → referral | Smoke + consent gate pass |
| C Profile → intro → mutual accept | ACL tests pass (demo storage) |
| D Family invite → revoke | Family assistant tests pass |
| E Paid service → checkout → fulfill | Sandbox lifecycle + audit log pass; no live charge |
| F Block/report | API/UI present; demo storage only |
| G Account deletion | Clears session/profile/voice keys in demo |
| H Shared link → app or web | Native parser + `/open/` fallback; Universal Links not verified (TEAMID placeholder) |

## Remaining blockers (production)

1. **No real matrimonial auth/API/database.** Membership is browser DEMO MODE.
2. **Razorpay not configured.** Checkout is sandbox; cards are rejected by design.
3. **No Amanikah production DB** → no DB permissions model and no backup/restore for member data.
4. **Mobile not store-ready:** Apple Team ID, Play signing fingerprint, certificates, screenshots from a phone install, crash sink, production API.
5. **Deep links incomplete:** `TEAMID` placeholder; `assetlinks.json` empty; Android `autoVerify` must stay off.
6. **Admin token for live billing** must be set before go-live (`BILLING_ADMIN_TOKEN`).
7. **CSP uses `'unsafe-inline'`** for styles/scripts (site is static inline-friendly); tighten if a build pipeline hashes assets.
8. **Core Web Vitals** not scored in this audit.
9. **No mailbox** for contact/signup delivery.
10. **Family Assistant / Voice / payments** remain demo or sandbox.

## Production configuration requirements

```bash
# Billing (when ready)
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
BILLING_MODE=live
BILLING_ADMIN_TOKEN=...   # required for dashboard + fulfill in live mode
SANDBOX_WEBHOOK_SECRET=... # rotate; keep for sandbox only

# Optional analytics
# Set window.AMANIKAH_ANALYTICS_ENDPOINT only after consent UX is accepted
```

Replace `TEAMID` in `/.well-known/apple-app-site-association` and publish real Play SHA-256 in `assetlinks.json` before enabling verified app links.

## Deployment instructions (current VPS)

1. Static site is `/var/www/amanikah`, served by Caddy from `/root/L/deploy/Caddyfile`.
2. Validate Caddy, then recreate **only** Caddy:
   ```bash
   docker run --rm --env-file /root/L/.env \
     -v /root/L/deploy/Caddyfile:/etc/caddy/Caddyfile:ro \
     caddy:2.8-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
   cd /root/L && docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate caddy
   ```
3. Billing:
   ```bash
   cd /root/amanikah-billing && docker compose up -d --force-recreate
   ```
4. Do not recreate AirRates API/mongo/frontend unless intentionally changing them.
5. Mobile debug APK (if rebuilt): `/root/amanikah-mobile/android/app/build/outputs/apk/debug/app-debug.apk` — debug-signed only.

## Go / no-go

**NO-GO** for production membership, live payments, or store release.

**OK to keep serving** the marketing site, demo membership, sandbox checkout, and campaign tools with clear sandbox/demo labeling, as they are today.
