# Amanikah UX redesign — results

Date: 2026-11-15

## Implemented

- **Visual system:** Cormorant Garamond + Source Sans 3; emerald / ivory / gold tokens; shared focus/hover/error states; Hindi/Urdu/Telugu font stacks on multilingual routes.
- **Homepage:** Required hero copy; primary CTA **Create My Private Profile**; secondary **Discover My Nikah Priorities**; sections for today, introductions, optional checks, family, #SimpleNikah, free vs paid; waitlist honesty badge.
- **#SimpleNikah:** Server-backed unlisted shares (`POST/GET /api/amanikah/shares`, `POST …/revoke`). Revocation returns HTTP 410 for all visitors. Copy no longer claims device-only revoke hides shared links.
- **Quiz:** Recover banner for saved answers; resume / open profile / start fresh; focus and invalid states; typography aligned to site system.
- **Membership demo:** Shared membership CSS; empty states for matches and introductions.
- **Pricing:** Catalog-driven page with sandbox honesty, inclusions/exclusions via existing billing renderer, unique SEO tags.
- **SEO:** Unique titles/descriptions/canonicals on key routes; sitemap drops noindex membership paths; WebSite + Organization JSON-LD on home.

## Playwright results (actual)

Command: `npx playwright test ux_redesign.spec.mjs` in `/root/amanikah-site/tests/playwright`

| Test | Result |
|---|---|
| Homepage hero CTAs + waitlist honesty (desktop) | PASS |
| Homepage mobile overflow | PASS |
| Pricing catalog load | PASS |
| Quiz mobile progress | PASS |
| SimpleNikah server share create + revoke | PASS |
| Membership demo register visible | PASS |
| SEO essentials (unique titles, desc, canonical) | PASS |

**7 passed** (≈13.7s). Screenshots: `tests/playwright/screenshots/`.

## Remaining problems

1. Matchmaking still waitlist / not live — correct product state, not a visual bug.
2. Operator email still unconfigured — notifications queue.
3. Live payments still sandbox.
4. Share page / some secondary routes still show mixed CTA labels in places; primary marketing nav updated.
5. Visual regression baselines are screenshots only (no pixel-diff CI gate yet).
6. Phone verification and live document checks remain future work.
7. Gold-on-ivory waitlist badge contrast is intentional but may fail strict WCAG AA for small text — consider darker gold if audits require it.
