#!/usr/bin/env bash
# Read-only public smoke check. Never posts member data or credentials.
set -Eeuo pipefail
BASE="${BASE_URL:-https://amanikah.com}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
for path in / /simple-nikah/ /nikah-readiness/ /account/register.html /pricing/ /privacy.html /safety.html /family-guide/; do
  curl -fsSL --max-time 20 -H 'Cache-Control: no-cache' "$BASE$path" -o "$tmp/page.html"
  test -s "$tmp/page.html"
  printf 'OK: %s\n' "$path"
done
curl -fsSL --max-time 20 -H 'Cache-Control: no-cache' "$BASE/" -o "$tmp/home.html"
grep -q 'A simple, respectful start' "$tmp/home.html" || { echo "STALE_HOMEPAGE: new release copy absent"; exit 3; }
grep -q 'story-outside-disclosure' "$tmp/home.html" || { echo "STALE_VIDEO_OVERLAY: film still cluttered"; exit 6; }
grep -q 'button-updates' "$tmp/home.html" || { echo "UNREADABLE_UPDATES_CTA: new button markup missing"; exit 7; }
grep -q 'id="nri"' "$tmp/home.html" || { echo "MISSING_NRI_SECTION"; exit 4; }
grep -q 'finish-2026.css' "$tmp/home.html" || { echo "MISSING_NEW_STYLESHEET"; exit 5; }
curl -fsSL --max-time 25 -H 'Cache-Control: no-cache' "$BASE/css/finish-2026.css" -o "$tmp/finish.css"
test -s "$tmp/finish.css"
curl -fsSL --max-time 20 -H 'Cache-Control: no-cache' "$BASE/icon.svg?v=2" -o "$tmp/icon.svg"
grep -q 'viewBox="0 0 128 128"' "$tmp/icon.svg" || { echo "NEW_LOGO_NOT_PUBLISHED"; exit 8; }
curl -fsSL --max-time 45 -H 'Cache-Control: no-cache' "$BASE/images/film/amanikah-story-30s.mp4" -o "$tmp/film.mp4"
test "$(wc -c < "$tmp/film.mp4")" -gt 100000
status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$BASE/api/amanikah/me/voice")"
case "$status" in
  401) echo 'OK: unauthenticated private voice endpoint denied';;
  404) echo 'WARN: voice endpoint not deployed yet';;
  *) echo "WARN: private voice endpoint unexpected status $status";;
esac
echo 'PUBLIC_SITE_RELEASE_CHECK_COMPLETE'
echo 'This check does not authenticate users, send emails, verify private media or prove commercial launch readiness.'
