# Amanikah Premium Redesign — Production Integration

**Date:** 15 November 2026  
**Package:** `/root/Amanikah_Premium_Redesign_Ready_For_Cursor.zip`  
**Backup:** `/root/amanikah-backup-pre-premium-redesign-20261115T180858Z.tar.gz`  
**Live URL:** https://amanikah.com/

## What was integrated

Ported the Revamp 2026 homepage **design and copy** into the live static site. Did **not** replace production quiz/pledge with the package’s client-only modal demos.

| Area | Decision |
|---|---|
| Hero / nav / sections / FAQ / footer | New premium layout live |
| Quiz CTA | → `/nikah-readiness/` (server-backed product) |
| Pledge CTA | → `/simple-nikah/` (server share + revoke) |
| Account CTA | → `/account/register.html` |
| Waitlist CTA | → `/signup.html` |
| Nav label `Today` | Replaced with **Our approach** |
| Public `/register` demo links on homepage + billing family CTAs | Removed from marketing journeys |
| Embedded quiz/pledge modals from ZIP | **Not deployed** (would duplicate mature flows) |

## Files changed

- `/var/www/amanikah/index.html` — premium homepage
- `/var/www/amanikah/css/premium-home.css` — design layer
- `/var/www/amanikah/css/site.css` — still loaded (tokens/shared); cache bump `?v=7`
- `/var/www/amanikah/signup.html` — waitlist copy no longer pushes demo `/register`
- `/var/www/amanikah/{services,billing,checkout,orders,refund-policy}/index.html` — CTA → production account

## Tests executed

| Suite | Result |
|---|---|
| Playwright Chromium/Firefox/WebKit @ 320, 390, 768, 1440 | **12/12 PASS** |
| CTA journeys (register, quiz, pledge) | **PASS** |
| No `Today` nav; no homepage `href="/register"` | **PASS** |
| Overflow ≤ 2px | **PASS** |

Evidence: `/root/amanikah-site/tests/playwright/qa-artifacts/premium/`

## Rollback

```bash
tar -xzf /root/amanikah-backup-pre-premium-redesign-20261115T180858Z.tar.gz -C /var/www
```

## Remaining blockers (unchanged)

- Operator / member email: `OPERATOR_EMAIL` + Resend/SMTP still missing  
- `MATCHMAKING_LIVE=0`  
- Billing sandbox only  
- Safety E2E still requires staging  

**Commercial launch:** still **NO-GO**.  
**Public early-access homepage redesign:** **deployed**.
