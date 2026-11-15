# Amanikah Interactive Homepage Film — Production Integration

**Date:** 15–16 November 2026  
**Package:** `/root/Amanikah_Interactive_Homepage_Video.zip`  
**Live URL:** https://amanikah.com/  
**Backup HTML:** `/root/amanikah-index-pre-film-*.html`

## What shipped

Branching interactive film on the **live** premium homepage — not a disconnected static demo.

| Piece | Location |
|---|---|
| Hero muted looping video + open CTA | `/var/www/amanikah/index.html` |
| Branching dialog (perspective → priority → CTAs) | `#amanikahStory` |
| Logic | `/var/www/amanikah/js/interactive-film.js` |
| Styles | `/var/www/amanikah/css/interactive-film.css` |
| Assets (same-origin) | `/var/www/amanikah/images/film/*.mp4`, `*.webp` |
| Analytics allowlist | `film_open`, `film_perspective_chosen`, `film_priority_chosen`, `film_cta_clicked` in `amanikah-api/server.py` |

## Product behavior (verified)

1. Homepage text + **Create private profile** / **Nikah priorities** remain usable without video.  
2. “Explore the interactive story” / nav **The story** open an accessible dialog (Esc, focus trap, pause).  
3. Choices: adult / family / NRI → simple nikah / privacy / family involvement.  
4. Scene switches actor → couple clip; copy updates.  
5. Final CTAs go to **real** `/account/register.html?from=film` and `/nikah-readiness/?from=film` (no duplicate quiz modal).  
6. AI actors labeled as fictional / not testimonials.  
7. Reduced-motion and Save-Data skip autoplay.  
8. Analytics send only coarse enum keys (no matrimonial free text).

## Tests

| Suite | Result |
|---|---|
| Playwright Chromium/Firefox/WebKit × 320/390/768/1440 | **12/12 PASS** |
| Branch + Esc + quiz CTA | **PASS** |
| `POST /api/amanikah/analytics/events` `film_open` | **200** |
| Lighthouse homepage (post-film) | see below |

Evidence: `/root/amanikah-site/tests/playwright/qa-artifacts/film/`

## Lighthouse (executed)

| Metric | Value |
|---|---|
| Performance | 72 |
| Accessibility | 95 (contrast polish applied after; recheck recommended) |
| Best practices | 100 |
| SEO | 100 |
| LCP | ~4490 ms (h1; video is poster-first / lazy) |
| CLS | ~0.02 |

LCP is higher than the pre-film homepage (~2.6s / Perf 93). Treat the film as an early-access experiment; consider an A/B or poster-only default on slow networks if registrations drop.

## Not done / remaining

- No A/B framework yet (hero vs film) — monitor LCP/registrations manually.  
- Clips are **AI illustrative**, not released live-action; replace before paid ads (per package guidance).  
- Operator email / live matchmaking / live billing still **NO-GO**.

## Rollback

```bash
# restore prior homepage HTML (pick latest pre-film backup)
cp /root/amanikah-index-pre-film-YYYYMMDDTHHMMSSZ.html /var/www/amanikah/index.html
# optional: remove film assets
# rm -rf /var/www/amanikah/images/film /var/www/amanikah/js/interactive-film.js /var/www/amanikah/css/interactive-film.css
```

**Launch status for film feature:** **GO for early-access public homepage** (illustrative AI media).  
**Commercial / paid-ads status:** **NO-GO** until live-action releases + mail/matching/billing gates pass.
