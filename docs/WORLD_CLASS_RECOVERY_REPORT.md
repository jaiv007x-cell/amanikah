# Amanikah — World-Class Product Recovery Report

**Date:** 16 November 2026  
**Target:** https://amanikah.com/  
**Scope:** Existing production stack only (no AirRates changes)

---

## Phase 0 — Audit (executed)

### Feature flags / environment
| Flag / setting | Status |
|---|---|
| `WAITLIST_MODE` | **1** |
| `MATCHMAKING_LIVE` | **0** |
| Billing | **sandbox** |
| `OPERATOR_EMAIL` | **MISSING** |
| Resend / SMTP | **MISSING** |
| `mailConfigured` | **false** |

### Route → backend map
| Route | Handler | Store |
|---|---|---|
| `/` marketing | Caddy static `/var/www/amanikah` | — |
| `POST /api/amanikah/leads` | amanikah-api:8090 | SQLite leads + outbox |
| `POST /api/amanikah/tickets` | amanikah-api | SQLite tickets |
| `POST /api/amanikah/auth/*` | amanikah-api | members/sessions |
| `/account/*` | static + platform API | production DB |
| `/register` `/login` SPA | demo localStorage | **not production** |
| `/simple-nikah/` `/nikah-readiness/` | static + JS + shares API | local + shares table |
| `/api/billing/*` | amanikah-billing | sandbox |
| `/ops/` | ops UI + `X-Ops-Token` | same DB |

### Live checks
| Check | Result |
|---|---|
| Public routes HTTP 200 | **PASS** |
| Waitlist lead create (`AK-6B3668`) | **PASS** (stored) |
| Support ticket (`SP-8CE1CD`) | **PASS** (stored) |
| Operator email delivery | **BLOCKED** (`NO_OPERATOR_EMAIL`) |
| Safety E2E artificial incident | **NOT TESTED** (policy) |
| Live matchmaking / live payments | **NOT ENABLED** |

### Findings addressed
- Homepage headline/CTAs updated to recovery brief  
- Design system tokens applied  
- Journey / verification / pricing / support honesty sections added  
- Mobile hero shortened (film hidden ≤760px so primary CTA is above the fold)  
- Film pause preference persisted; calm pace retained  
- No homepage `href="/register"` demo CTA  

---

## Phase 1 — Design system

**File:** `/var/www/amanikah/css/design-system.css`  
Tokens: Emerald `#073B32`, Jade `#146B56`, Gold `#D3AF64`, Champagne `#F1DFC0`, Ivory `#FBF8F1`  
Components: typography kickers, buttons, badges, cards, fields, progress, empty/loading/error, dialog helpers, band backgrounds.

Also aligned `/css/site.css` primary tokens for shared pages.

---

## Phase 2 — Homepage reconstruction

Headline: **Your values. Your choice. Your Nikah.**  
Primary CTA → `/account/register.html`  
Secondary CTA → `/nikah-readiness/`  
Added: journey, verification, pricing preview (sandbox), support/operator honesty, existing SimpleNikah/quiz/editorial/FAQ retained and linked to real routes.

---

## Phase 3 — Cinematic film

- Still using approved AI illustrative clips (truthfully labeled; original live-action **not** available yet)  
- Calm pace 0.75×, Replay, Pause; no sound autoplay  
- Poster-first / lazy MP4; reduced-motion & Save-Data respected  
- Manual pause preference: `localStorage amanikah.film.pausePref`  
- Mobile: hero film deferred so registration CTA stays visible  

---

## Phase 4–5 — Journey / trust / revenue

- Public copy states matchmaking **not live**, billing **sandbox**  
- Production account path emphasized; demo SPA not linked from homepage  
- Pricing preview mirrors real catalog amounts with sandbox labeling  
- Support: messages stored; email delivery blocked until credentials  

---

## Phase 6 — QA (executed)

Playwright Chromium / Firefox / WebKit × **320, 375, 390, 768, 1024, 1440**: **18/18 PASS**  
Evidence: `/root/amanikah-site/tests/playwright/qa-artifacts/recovery/`

### Lighthouse (homepage, Chromium headless → 127.0.0.1)
| Category | Score |
|---|---|
| Performance | **72** |
| Accessibility | **95** |
| Best practices | **100** |
| SEO | **100** |

| Metric | Value |
|---|---|
| LCP | **4402 ms** |
| CLS | **0** |
| TBT | **0 ms** |

Artifact: `tests/playwright/qa-artifacts/recovery/lighthouse-home.json`  
Note: LCP is film/poster-heavy; mobile defers story-hero. Further LCP work is optional polish, not a recovery blocker for early-access UX.

### Viewport / browser matrix
Chromium, Firefox, WebKit × 320 / 375 / 390 / 768 / 1024 / 1440 → **18/18 PASS**  
Screenshots + `smoke.json` under `qa-artifacts/recovery/`.

---

## Phase 7 — Deployment

### Files changed
- `/var/www/amanikah/index.html`  
- `/var/www/amanikah/css/design-system.css` *(new)*  
- `/var/www/amanikah/css/site.css` (tokens)  
- `/var/www/amanikah/js/interactive-film.js` (pause preference)  
- `/root/amanikah-site/WORLD_CLASS_RECOVERY_REPORT.md` *(this report)*

### Actual tests run
1. Playwright recovery smoke — 18/18 PASS  
2. Live lead `AK-6B3668` + ticket `SP-8CE1CD` — stored; email **BLOCKED**  
3. Lighthouse homepage — scores above  

### Performance measurements
See Lighthouse table. CLS 0; LCP ~4.4s on cold headless load (film assets).

### Rollback
```bash
cp /root/amanikah-index-pre-recovery-20261115T195137Z.html /var/www/amanikah/index.html
# optional: remove <link rel="stylesheet" href="/css/design-system.css?v=1">
```

### Database migration / rollback
**None required** for this pass (no schema change).

### Feature flags (current production)
`WAITLIST_MODE=1` · `MATCHMAKING_LIVE=0` · billing **sandbox** · `mailConfigured=false` · `OPERATOR_EMAIL` unset

### Release checklist
- [x] Design tokens + homepage copy live  
- [x] Primary CTA → `/account/register.html` (production)  
- [x] No homepage link to demo `/register`  
- [x] Sandbox / not-live claims visible  
- [x] Film pause preference + truthful AI labeling  
- [x] Multi-browser viewport smoke  
- [x] Lighthouse snapshot  
- [ ] Operator email credentials  
- [ ] Live-action film assets  
- [ ] Matchmaking staffed + safety gates  
- [ ] Live billing (leave sandbox until then)

### Go / No-Go
| Decision | Verdict |
|---|---|
| Public early-access UX recovery | **GO** (already live on amanikah.com) |
| Commercial launch (live matching, live pay, paid ads with AI actors) | **NO-GO** |
| Operator email notifications | **NO-GO** until `OPERATOR_EMAIL` + Resend/SMTP |

---

## Remaining dependencies
1. Configure operator mail and retest delivery.  
2. Replace AI film with consented live-action before paid acquisition.  
3. Staffed fulfillment + safety gates before `MATCHMAKING_LIVE` or live Razorpay.  
4. Staging host for safety-report E2E.  
5. Optional LCP polish (poster weight / deferral) after commercial gates.  
