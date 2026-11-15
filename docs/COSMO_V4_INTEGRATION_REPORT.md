# Amanikah Cosmopolitan Emerald & Gold v4 — Integration

**Date:** 16 November 2026  
**Package:** `/root/Amanikah_Cosmopolitan_Emerald_Gold_v4.zip`  
**Live:** https://amanikah.com/ only  
**AirRates:** **not modified** (confirmed: no cosmo files under `/root/L`, no markers on airrates frontend)

## Pickup note

Another agent session started this deploy and aborted mid-verify after writing assets/CSS/HTML/JS to `/var/www/amanikah`. This session finished verification, fixed mobile cinema-control reachability, and documented rollback.

## What is live

| Item | Path |
|---|---|
| Design overlay | `/var/www/amanikah/css/cosmopolitan-v4.css` |
| Editorial stills + geometry | `/var/www/amanikah/images/cosmo/` |
| Optimized film MP4s | `/var/www/amanikah/images/film/` |
| Calm pace / Replay / no-loop | `/var/www/amanikah/js/interactive-film.js` |
| Homepage | `/var/www/amanikah/index.html` (`cosmo-v4`, editorial strip, unhurried film copy) |

Preserved: production `/account/register.html`, `/nikah-readiness/`, `/simple-nikah/`, `/signup.html`, API/billing, waitlist honesty.

## Fixes completed after abort

1. Hero title restored to non-heading `.story-hero-title` (heading-order).  
2. Cinema controls moved into the dialog **right pane** so Calm pace / Replay remain usable at 320–390px (were clipped inside the film pane).  
3. Confirmed no `DHLVIRAL` / AirRates strings on Amanikah pages.

## Tests

Playwright Chromium / Firefox / WebKit × 320, 390, 768, 1440: **12/12 PASS**  
Evidence: `/root/amanikah-site/tests/playwright/qa-artifacts/cosmo-v4/`

## Backup / rollback

```bash
cp /root/amanikah-index-pre-cosmo-v4-20261115T190752Z.html /var/www/amanikah/index.html
# optional: restore prior film dir from /root/amanikah-film-backup-*
```

## Status

- **Cosmo v4 on amanikah.com:** GO (early-access visual + calm film)  
- **AirRates:** untouched  
- **Commercial matchmaking / live billing / operator email:** still NO-GO  
- **Paid ads with AI actors:** still NO-GO until live-action releases  
