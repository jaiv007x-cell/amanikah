# Amanikah.com — Full Website Regression Backtest

**Date:** 15 November 2026  
**Target:** https://amanikah.com/  
**Engines:** Playwright Chromium, Firefox, WebKit  
**Viewports:** 320, 375, 390, 768, 1024, 1440  
**Commercial launch decision:** **NO-GO**  
**Public waitlist / production accounts (gated):** **GO with known blockers**

Evidence root: `/root/amanikah-site/tests/playwright/qa-artifacts/regression/`  
Machine-readable matrix: `test-matrix.json` / `test-matrix.md`

---

## 1. Inventory (executed)

| Class | Routes checked | Result |
|---|---|---|
| Public | `/`, signup/contact/safety/privacy/terms/help, quiz, SimpleNikah, nikah-readiness, pricing/services/billing/checkout/orders/refund-policy, open | **200** |
| Production accounts | `/account/`, register, login, verify | **200** |
| Demo SPA | `/register`, `/login`, `/dashboard`, `/onboarding`, `/matches`, `/settings`, … | **200** (localStorage demo) |
| Operator | `/ops/` | **200** |
| API | `/api/amanikah/health`, leads, tickets, auth, shares, analytics, ops/*; `/api/billing/*` | live |
| Flags | `WAITLIST_MODE=1`, `MATCHMAKING_LIVE=0`, billing `sandbox`, `mailConfigured=false` | verified |

`/safety` previously served the **demo SPA**. Fixed: **302 → `/safety.html`**.

---

## 2. Defects found and fixed

| Sev | Defect | Fix | Retest |
|---|---|---|---|
| **P0** | When transactional mail is off, member verify tokens were not recoverable by operators (hashed only) — accounts could not be verified | Ops notification includes verify URL; `POST /api/amanikah/ops/members/{id}/verify-link`; `GET /ops/notifications/{id}` with body | **PASS** (AUTH-01) |
| **P1** | `/safety` Caddy membership rewrite served demo app instead of production safety | Removed `/safety` from demo rewrite; `redir /safety /safety.html 302` | **PASS** (INV-01) |
| **P1** | Revoked SimpleNikah share HTML returned **HTTP 200** (API was 410 only) | Caddy proxies `share.html?s=*` → API; API returns **410** HTML without pledge payload | **PASS** (SN-01) |
| **P1** | Pricing CTA in JS pointed at demo `/register` | `billing.js` → `/account/register.html` | **PASS** (BILL-01) |
| **P2** | Pricing page only showed “Loading…” → crawl weak + CLS **0.36** | Static sandbox fee fallback in `pricing/index.html` | LH CLS **0.013**, Perf **88** |

No live matchmaking or live payments were enabled.

---

## 3. Test matrix summary

| Result | Count |
|---|---|
| PASS | 32+ (30 Playwright + API e2e suites + LH) |
| BLOCKED | 2 (member mailbox delivery; operator mailbox delivery — credentials missing) |
| NOT TESTED | 1 (safety-report E2E on production — policy: use staging; no staging host) |
| FAIL | **0** after fixes |

Playwright final run: **30/30 passed**.  
`platform_e2e_test.py`: **PASS**.  
`reconciliation_e2e_test.py`: **PASS**.

### Representative rows

| ID | Result | Notes |
|---|---|---|
| INV-01 | PASS | Route inventory + flags + `/safety` redirect |
| BR-* | PASS | 3 browsers × 6 viewports homepage screenshots |
| FUN-01 | PASS | Homepage → waitlist → reference → ops lead |
| FUN-02 | PASS | Homepage → production `/account/register.html` |
| FUN-03 | PASS | Quiz complete → signup path |
| SN-01 | PASS | Share create/open/revoke → **HTTP 410**; no private prefs in 410 HTML |
| QUIZ-01 | PASS | 10 questions, back, mid refresh, results |
| AUTH-01 | PASS | Register → ops verify-link → login → profile → withdraw → delete; bad token 401 |
| LEAD-01 | PASS | Waitlist + support ticket; notification stored, not emailed |
| SAFE-01 | NOT TESTED | No artificial safety tickets on production; no staging |
| BILL-01 | PASS | Sandbox ≠ revenue; crawlable pricing |
| SEO-01 | PASS | robots, sitemap, HSTS/CSP/XCTO/XFO |
| SEC-01 | PASS | Ticket rate limit returns 429 |
| A11Y-01 | PASS | 0 axe critical on key pages |
| LH-01 | PASS | See scores below |
| MAIL-01 | BLOCKED | `OPERATOR_EMAIL` + Resend/SMTP missing |

Full table: `qa-artifacts/regression/test-matrix.md`

---

## 4. Lighthouse (executed)

| Page | Perf | A11y | BP | SEO | LCP (ms) | CLS |
|---|---|---|---|---|---|---|
| `/` | 93 | 100 | 100 | 100 | 2631 | 0.008 |
| `/nikah-readiness/` | 92 | 100 | 100 | 100 | 2679 | 0.000 |
| `/simple-nikah/` | 91 | 100 | 100 | 100 | 2829 | 0.034 |
| `/signup.html` | 92 | 100 | 100 | 100 | 2648 | 0.015 |
| `/pricing/` (retest) | 88 | 100 | 100 | 100 | 3090 | **0.013** |

---

## 5. Files changed

| File | Change |
|---|---|
| `/root/amanikah-api/server.py` | Ops verify-link; notification verify URL; share HTML 410 handler; notification detail |
| `/root/amanikah-api/docker-compose.yml` | Mount `/var/www/amanikah` as `SITE_ROOT` |
| `/root/amanikah-api/ops.env` (+ example) | `SITE_ROOT=/srv/amanikah` (no secrets printed) |
| `/root/L/deploy/Caddyfile` | Share proxy; `/safety` redirect; remove demo `/safety` rewrite |
| `/var/www/amanikah/pricing/index.html` | Crawlable sandbox fee fallback |
| `/var/www/amanikah/js/billing.js` | Production account CTA |
| `/root/amanikah-site/tests/playwright/full_regression.spec.mjs` | Regression suite + matrix writer |

---

## 6. Remaining configuration requirements

1. Set `OPERATOR_EMAIL` and either `RESEND_API_KEY` or SMTP credentials (do not invent).  
2. Retest mailbox delivery to an authorized operator address.  
3. Provide a **staging** host before safety-report E2E.  
4. Keep `MATCHMAKING_LIVE=0` and billing sandbox until fulfillment/safety gates pass.  
5. Legal retention windows still need operator decision (flagged earlier in privacy/terms).

---

## 7. Production readiness decision

**NO-GO for commercial launch** (live matching, live payments, fulfillment, operator email).

**GO for continued public waitlist and gated production accounts**, with:

- Verified waitlist URL: https://amanikah.com/signup.html  
- Verified production registration: https://amanikah.com/account/register.html  
- Verified share revoke returns **HTTP 410**  
- Verified `/safety` → production safety page  
- Operator notifications **queued** only until mail is configured  

Screenshots: `qa-artifacts/regression/screenshots/`
