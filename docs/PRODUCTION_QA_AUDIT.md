# Amanikah.com — Production QA Audit

**Date:** 15 November 2026  
**Environment:** Live VPS (`amanikah.com` → 127.0.0.1 for local evidence)  
**Recommendation:** **NO-GO for full commercial launch** (matchmaking + live payments).  
**Conditional:** Waitlist / content / sandbox billing may remain public with honesty labels.

Artifacts: `/root/amanikah-site/tests/playwright/qa-artifacts/`  
Playwright suite: `qa_audit.spec.mjs` — **24 passed** (final run).  
Lighthouse report: `qa-artifacts/lighthouse-home.report.html` / `.json`

---

## Executive evidence summary

| Area | Result |
|---|---|
| Playwright Chromium / Firefox / WebKit smoke | PASS |
| Viewports 320 / 375 / 390 / 768 / 1280 overflow | PASS |
| axe WCAG 2.2 AA-oriented (marketing pages) | PASS after contrast fix (0 serious on homepage recheck) |
| Lighthouse Performance | **85** (measured) |
| Lighthouse Accessibility | **100** (measured) |
| Lighthouse Best Practices | **100** (measured) |
| Lighthouse SEO | **100** (measured) |
| LCP | **3.4 s** (score 0.66) |
| CLS | **0.008** (score 1) |
| INP | **NOT TESTED** (this Lighthouse build exposed `max-potential-fid: 20 ms`, not field INP) |
| Integration suites (9) | ALL EXIT 0 |
| ESLint / tsc | **NOT TESTED** — no project lint/tsconfig for vanilla marketing + demo SPA |
| Backup restore drill | **NOT TESTED** |
| Operator email delivery | **NOT TESTED** — `mailConfigured: false` |

---

## Prioritized defect report

### DEF-01 — Stale privacy policy contradicted production API
| | |
|---|---|
| **Page** | `/privacy.html` |
| **Severity** | **Critical** (trust / legal accuracy) |
| **Steps** | Open Privacy; read “What is not collected” / #SimpleNikah revoke |
| **Expected** | Documents server waitlist, tickets, production accounts, server share revoke |
| **Actual** | Claimed no account database; said revoke was device-only |
| **Source** | `/var/www/amanikah/privacy.html` |
| **Fix** | Rewrote privacy copy to match platform API + production accounts + server shares |
| **Test** | Manual + journey12 deletion path still documented; smoke PASS |

### DEF-02 — `robots.txt` blocked marketing Safety page
| | |
|---|---|
| **Page** | `/robots.txt` → `/safety.html` |
| **Severity** | **High** (SEO / crawlability) |
| **Steps** | Prefix rule `Disallow: /safety` matches `/safety.html` in Googlebot |
| **Expected** | Marketing safety page crawlable; SPA `/safety` disallowed |
| **Actual** | `/safety.html` disallowed |
| **Source** | `/var/www/amanikah/robots.txt` |
| **Fix** | Added longer `Allow: /safety.html` override while keeping `Disallow: /safety` |
| **Test** | Playwright robots assertion PASS |

### DEF-03 — Gold kicker text failed WCAG contrast
| | |
|---|---|
| **Page** | `/` (and kickers sitewide) |
| **Severity** | **High** (a11y) |
| **Steps** | axe scan homepage |
| **Expected** | AA contrast for text |
| **Actual** | `color-contrast` serious on `.kicker` (13 nodes) |
| **Source** | `/var/www/amanikah/css/site.css` |
| **Fix** | Introduced `--gold-text: #6b5524`; applied to kickers, badge, step labels |
| **Test** | axe homepage recheck: **0 serious**; full suite axe PASS |

### DEF-04 — API access logs suppressed
| | |
|---|---|
| **Page** | `amanikah-api` |
| **Severity** | **High** (ops / abuse investigation) |
| **Steps** | `docker logs amanikah-api` after traffic |
| **Expected** | Structured request logging without secrets |
| **Actual** | `log_message` returned immediately (no access logs) |
| **Source** | `/root/amanikah-api/server.py` `Handler.log_message` |
| **Fix** | JSON access logs: ts, client, method, path (no bodies/tokens) |
| **Test** | Redeployed; health request produces JSON log line |

### DEF-05 — Operator transactional email unconfigured
| | |
|---|---|
| **Page** | Contact / signup / safety notifications |
| **Severity** | **High** (ops delivery) for “operator receives” |
| **Steps** | Submit contact; inspect notification payload |
| **Expected** | Email to operator when configured |
| **Actual** | Tickets/leads stored; `email.sent: false`, code `NO_OPERATOR_EMAIL` / mail not configured |
| **Source** | `/root/amanikah-api/ops.env` |
| **Fix** | Not a code bug — configuration required (`CONFIG.md`). Outbox persists (no silent discard). |
| **Test** | Journey11 PASS for server acceptance; email send **NOT TESTED** |

---

## Medium / low (observed, not all fixed)

| ID | Severity | Issue | Status |
|---|---|---|---|
| DEF-06 | Medium | LCP 3.4s (hero image / fonts) | Measured; not optimized further this pass |
| DEF-07 | Medium | Dual membership (demo `/register` vs production `/account`) can confuse | Labeled in UI; no merge of demo→prod |
| DEF-08 | Medium | Matchmaking not live / waitlist mode | Intentional product gate |
| DEF-09 | Medium | Live Razorpay not configured | Sandbox only; billing_test PASS |
| DEF-10 | Low | `membership_acl_test` stdout still says “no real auth DB” | Stale note only; production API exists separately |
| DEF-11 | Low | No ESLint/tsc pipeline | NOT TESTED / N/A for current stack |

---

## Required journeys — evidence

| # | Journey | Result | Evidence |
|---|---|---|---|
| 1 | Quiz → real account | **PASS** | Playwright Journey1; production register API |
| 2 | Pledge share link | **PASS** | Journey2+3 create share |
| 3 | Referral opens link → account | **PASS** | Journey2+3 |
| 4 | Mutual introduction accept | **PASS** | Journey4+5 demo + ACL suite |
| 5 | Rejected intro hides contact | **PASS** | Journey4+5 before mutual |
| 6 | Family sees only permitted | **PASS** | `family_assistant_test.py` + ACL |
| 7 | Revoked family permissions block | **PASS** | family assistant consent revoke tests |
| 8 | Verification request | **PASS** | Journey8 ops verification API + `/verification` UI |
| 9 | Purchase in test mode | **PASS** | `billing_test.py` |
| 10 | Operator processes order | **PASS** | billing fulfill path in suite |
| 11 | Support / safety report | **PASS** | Journey11 UI → 201 tickets |
| 12 | Account deletion | **PASS** | Journey12; login fails after delete |

---

## Technical checks

| Check | Result |
|---|---|
| HTTP status (required pages) | All **200**; unknown **404** |
| Broken navigation | No broken primary links in smoke |
| Canonical domain | `https://amanikah.com/...` |
| robots + sitemap | Present; safety.html allowed after fix |
| Security headers | HSTS, CSP, XCTO, XFO, Referrer-Policy, Permissions-Policy |
| Auth / session | Production Bearer sessions; demo localStorage isolated |
| ACL / data isolation | membership_acl + platform_e2e PASS |
| XSS/CSRF | CSP present; API uses Bearer (not cookie CSRF); HTML escaped in SPA |
| Rate limit / honeypot | PASS (`REJECTED` / rate limiter present) |
| Consent analytics | Banned props stripped server-side |
| Fake success | Contact invalid submit keeps success hidden |
| Backups / restore | Volume exists; **restore NOT TESTED** |
| Structured logging | Fixed this audit (JSON access logs) |

---

## Browser matrix

| Browser / viewport | Result |
|---|---|
| Chromium desktop | PASS |
| Firefox desktop | PASS |
| WebKit desktop | PASS |
| 320 / 375 / 390 / 768 | PASS (overflow ≤2px; visible CTA ≥44px) |

---

## Fixes implemented in this audit

1. Privacy policy rewritten to match production behavior.  
2. `robots.txt` Allow override for `/safety.html`.  
3. Gold text contrast tokens (`--gold-text`).  
4. Structured JSON access logging in `amanikah-api`.  

---

## NOT TESTED (explicit)

- Field **INP** (CrUX / newer LH INP audit)  
- ESLint / TypeScript typecheck (no project config)  
- Database **backup restore** drill  
- Real **Resend/SMTP** delivery to a human inbox  
- Real **Razorpay** live charges  
- iOS/Android **store** installs  
- Multi-region CDN / WAF load tests  

---

## GO / NO-GO

**NO-GO** for launching Amanikah as a live matrimonial marketplace with paid fulfillment and guaranteed operator email SLAs.

**Evidence-based reasons:**
1. `MATCHMAKING_LIVE=0` / waitlist mode — introductions are not an operational product yet.  
2. Operator email unconfigured — reports/leads store, but operator email receipt unproven.  
3. Payments remain sandbox; services not deliverable as live paid work.  
4. Backup restore unproven.

**Allowed public state:** Marketing + waitlist + demo membership + sandbox catalog, with honesty labels (current posture), after the critical privacy/robots/a11y fixes above.
