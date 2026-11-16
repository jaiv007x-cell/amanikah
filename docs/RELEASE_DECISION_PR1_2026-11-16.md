# Amanikah PR #1 — Release decision (16 Nov 2026)

**PR:** https://github.com/jaiv007x-cell/amanikah/pull/1  
**Branch:** `feature/readable-home-family-guide-2026-11`  
**Head SHA:** `3e9e9c35337fc10d29be15973ee0e0feea16621b`  
**Base:** `main` (unmerged)

## 1. Architecture (verified on VPS)

| Component | Actual |
|---|---|
| Domain | https://amanikah.com/ |
| Static site | `/var/www/amanikah` → Caddy `/srv/amanikah` |
| Reverse proxy | Caddy in `airrates-caddy-1` (shared `airrates_edge`) — **not Nginx** |
| API | Docker `amanikah-api` → `amanikah-api:8090` |
| DB volume | Docker volume `amanikah-api_api_data` → `/data/amanikah.sqlite` |
| Secrets | `/root/amanikah-api/ops.env` only (not overwritten by release) |
| Billing | `amanikah-billing` sandbox |

## 2. Live vs GitHub gap

| Asset / route | GitHub PR | Live amanikah.com |
|---|---|---|
| `amanikah-story-30s.mp4` | present | **404** |
| `/account/family.html` | present | **404** |
| `/api/amanikah/me/voice` | 401 when mounted | **404** |
| `private_features.py` | present | **absent** |
| ffprobe in API image | Dockerfile installs | **missing** |
| `mailConfigured` | requires ops.env | **false** |
| Matchmaking | off | off (`waitlistMode: true`) |

Production was **not** modified during this audit.

## 3. Changes made in this engineering pass

- `site/css/readability-2026.css` — decorative film overlays `pointer-events: none`
- `site/js/interactive-film.js` — natural 1.0× default; muted; optional Calm only
- `site/tests/ui-smoke.spec.cjs` — added **1024px** viewport
- `site/tests/playwright.config.cjs` — local Chromium runner
- `scripts/deploy-amanikah-production.sh` — Caddy/edge-aware, no ops.env overwrite, no rsync `--delete`, ffprobe + private voice dir checks, mail gates retained
- `scripts/stage-amanikah-local.sh` — non-destructive staging checks
- `docs/PRIVATE_AI_VOICE_DEPLOYMENT_2026.md` — VPS reality notes

## 4. Automated tests actually run (this host)

| Gate | Result |
|---|---|
| `python -m compileall -q api` | **PASS** |
| `python -m unittest discover -s api/tests -v` | **8/8 PASS** |
| `node --check site/js/account-family-studio.js` | **PASS** |
| `node --check site/js/interactive-film.js` | **PASS** |
| ffprobe duration `amanikah-story-30s.mp4` | **30.000s** |
| Playwright Chromium UI smoke | **10/10 PASS** |
| Screenshots | `test-results/home-{320,375,390,768,1024,1440}.png` |
| GitHub Actions (prior CI on 86614c5) | browser + tests **pass** |

## 5. Security / product gates

| Gate | Status |
|---|---|
| Unauthorized voice (unit/HTTP tests) | **401/403 expected — covered in API tests** |
| Live unauthorized voice | **404** (route not deployed yet) |
| AI Wali | **DISABLED** (`AMANIKAH_AI_ENABLED` unset; remains rules-only until key + consent) |
| Transactional email | **BLOCKED** — `OPERATOR_EMAIL` empty, no Resend/SMTP |
| Family Studio auth boundary (UI) | signed-out studio **hidden** (Playwright) |
| Matchmaking / live billing | **OFF / sandbox** — leave off |
| Deploy script mail abort | **would BLOCK** on current ops.env |

## 6. Remaining operational dependencies

1. Set monitored `OPERATOR_EMAIL` and Resend **or** SMTP in existing `ops.env` (do not invent values).
2. Confirm SPF/DKIM for sending domain; real inbox receipt test.
3. Optional: set `OPENAI_API_KEY` + model + `AMANIKAH_AI_ENABLED=1` only after safety review.
4. Add GitHub Actions secrets for manual VPS workflow **or** run `RELEASE_ROOT=… bash scripts/deploy-amanikah-production.sh` after approval.
5. Human moderation runbook for voice reports.
6. Off-server backup/restore drill for SQLite + `/data/private_voice`.

## 7. Go / No-Go

| Decision | Verdict |
|---|---|
| Merge PR to `main` after CI green | **CONDITIONAL GO** (code quality OK) |
| Production deploy to amanikah.com | **NO-GO** until mailer configured + explicit DEPLOY approval |
| Enable matchmaking / live pay | **NO-GO** |
| Enable AI vendor calls | **NO-GO** until credentials + review |

**Production has not been deployed.** After you configure mail and reply with explicit **DEPLOY APPROVED**, merge PR #1 and run the gated release script.
