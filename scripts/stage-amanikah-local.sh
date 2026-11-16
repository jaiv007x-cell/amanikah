#!/usr/bin/env bash
# Local staging harness on the VPS host — does NOT touch production site/API/DB.
# Serves the reviewed site on :8765 and runs API private-feature tests against a temp DB.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "STAGING_ROOT=$ROOT"
python3 -m compileall -q api
python3 -m unittest discover -s api/tests -v
node --check site/js/account-family-studio.js
node --check site/js/interactive-film.js
test -s site/images/film/amanikah-story-30s.mp4
ffprobe -v error -show_entries format=duration -of default=nw=1 site/images/film/amanikah-story-30s.mp4
# Confirm live production still lacks PR assets (gap check) without changing it.
curl -s -o /dev/null -w 'live_film=%{http_code}\n' https://amanikah.com/images/film/amanikah-story-30s.mp4 || true
curl -s -o /dev/null -w 'live_voice=%{http_code}\n' https://amanikah.com/api/amanikah/me/voice || true
echo "STAGING_CHECKS_COMPLETE — production untouched."
