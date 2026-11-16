#!/usr/bin/env bash
# Amanikah production release runner. Requires root.
# Never overwrites ops.env, never replaces the live SQLite with an empty DB.
# Run only after GitHub QA, staging verification, and explicit operator approval.
set -Eeuo pipefail
umask 077
if [[ $(id -u) -ne 0 ]]; then echo ROOT_REQUIRED; exit 1; fi
if [[ -z "${RELEASE_ROOT:-}" || ! -d "$RELEASE_ROOT/site" ]]; then echo INVALID_RELEASE; exit 1; fi
APP_DIR=/root/amanikah-api
SITE_DIR=/var/www/amanikah
ENV_FILE="$APP_DIR/ops.env"
[[ -f "$RELEASE_ROOT/api/private_features.py" && -f "$RELEASE_ROOT/api/server.py" ]] || { echo INVALID_RELEASE; exit 1; }
[[ -f "$RELEASE_ROOT/api/Dockerfile" && -f "$RELEASE_ROOT/api/docker-compose.yml" ]] || { echo INVALID_RELEASE; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo MISSING_VPS_OPS_ENV; exit 1; }
# Production mail gates — do not invent credentials.
# Operator may set AMANIKAH_ALLOW_MAIL_SKIP=1 only with explicit DEPLOY APPROVED
# when transactional email is still being configured; verification mail will remain broken.
MAIL_SKIP="${AMANIKAH_ALLOW_MAIL_SKIP:-0}"
if [[ "$MAIL_SKIP" != "1" ]]; then
  grep -Eq '^OPERATOR_EMAIL=[^[:space:]]+@[^[:space:]]+' "$ENV_FILE" || { echo OPERATOR_EMAIL_NOT_CONFIGURED; exit 1; }
  if ! grep -Eq '^RESEND_API_KEY=[^[:space:]]+' "$ENV_FILE" && ! grep -Eq '^SMTP_HOST=[^[:space:]]+' "$ENV_FILE"; then
    echo TRANSACTIONAL_MAIL_NOT_CONFIGURED; exit 1
  fi
else
  echo "WARNING: AMANIKAH_ALLOW_MAIL_SKIP=1 — deploying without transactional email smoke test"
fi
[[ -d "$SITE_DIR" ]] || { echo SITE_DIR_MISSING; exit 1; }
command -v rsync >/dev/null
command -v docker >/dev/null
command -v curl >/dev/null
# Refuse if AirRates edge network is missing (shared reverse proxy).
docker network inspect airrates_edge >/dev/null 2>&1 || { echo EDGE_NETWORK_MISSING; exit 1; }
NOW=$(date -u +%Y%m%dT%H%M%SZ)
BACKUPS="$APP_DIR/backups"
install -d -m 700 "$BACKUPS"
# Snapshot static site (Caddy serves /var/www/amanikah as /srv/amanikah).
tar -C /var/www -czf "$BACKUPS/site-$NOW.tar.gz" amanikah
for f in server.py private_features.py docker-compose.yml Dockerfile; do
  if [[ -f "$APP_DIR/$f" ]]; then cp -p "$APP_DIR/$f" "$BACKUPS/$f.$NOW"; fi
done
# Consistent SQLite backup from the running container volume (never wipe /data).
if docker ps --format '{{.Names}}' | grep -qx 'amanikah-api'; then
  docker exec amanikah-api python -c "import sqlite3; a=sqlite3.connect('/data/amanikah.sqlite'); b=sqlite3.connect('/data/pre-release-$NOW.sqlite'); a.backup(b); b.close(); a.close()"
  docker cp "amanikah-api:/data/pre-release-$NOW.sqlite" "$BACKUPS/db-$NOW.sqlite"
  chmod 600 "$BACKUPS/db-$NOW.sqlite" || true
else
  echo EXISTING_API_NOT_RUNNING; exit 1
fi
restore_on_error(){
  echo "RELEASE_FAILED: attempting code and website rollback"
  tar -C /var/www -xzf "$BACKUPS/site-$NOW.tar.gz" || true
  for f in server.py private_features.py docker-compose.yml Dockerfile; do
    [[ ! -f "$BACKUPS/$f.$NOW" ]] || cp -p "$BACKUPS/$f.$NOW" "$APP_DIR/$f"
  done
  (cd "$APP_DIR" && docker compose up -d --build api) || true
}
trap restore_on_error ERR
# Ensure non-secret defaults exist without overwriting credentials.
if ! grep -Eq '^VOICE_PRIVATE_DIR=' "$ENV_FILE"; then
  printf '\nVOICE_PRIVATE_DIR=/data/private_voice\n' >> "$ENV_FILE"
fi
if ! grep -Eq '^AMANIKAH_AI_ENABLED=' "$ENV_FILE"; then
  printf 'AMANIKAH_AI_ENABLED=0\n' >> "$ENV_FILE"
fi
# Sync reviewed site. Do NOT use --delete: host may retain operator reports/backups
# outside the git tree. Never sync ops.env or databases into the web root.
rsync -a \
  --exclude 'backups/' \
  --exclude '*.sqlite' \
  --exclude '*.sqlite-*' \
  --exclude 'ops.env' \
  --exclude '.env' \
  "$RELEASE_ROOT/site/" "$SITE_DIR/"
install -m 600 "$RELEASE_ROOT/api/server.py" "$APP_DIR/server.py"
install -m 600 "$RELEASE_ROOT/api/private_features.py" "$APP_DIR/private_features.py"
install -m 644 "$RELEASE_ROOT/api/Dockerfile" "$APP_DIR/Dockerfile"
install -m 644 "$RELEASE_ROOT/api/docker-compose.yml" "$APP_DIR/docker-compose.yml"
# Install encrypted remote-backup helper, but never run it without private offsite credentials.
install -m 700 "$RELEASE_ROOT/scripts/backup-amanikah-offsite-restic.sh" "$APP_DIR/backup-amanikah-offsite-restic.sh"
# Never overwrite ops.env from the release tree.
cd "$APP_DIR"
docker compose config -q
docker compose up -d --build api
# Wait for health inside the shared edge network.
for i in 1 2 3 4 5 6 7 8; do
  if curl -fsS --max-time 5 https://amanikah.com/api/amanikah/health >/tmp/amanikah-health.json 2>/dev/null; then
    break
  fi
  sleep 2
done
python3 - <<'PY'
import json
d=json.load(open('/tmp/amanikah-health.json'))
assert d.get('ok') is True, d
PY
# ffprobe required for Voice Rishta WebM duration validation
docker exec amanikah-api sh -c 'command -v ffprobe >/dev/null'
docker exec amanikah-api sh -c 'mkdir -p /data/private_voice && chmod 700 /data/private_voice'
curl -fsS --max-time 15 -o /dev/null https://amanikah.com/images/film/amanikah-story-42s.mp4
VOICE_STATUS=$(curl -s --max-time 15 -o /dev/null -w '%{http_code}' https://amanikah.com/api/amanikah/me/voice)
[[ "$VOICE_STATUS" == 401 ]] || { echo PRIVATE_VOICE_ROUTE_EXPOSED; exit 1; }
WALI_STATUS=$(curl -s --max-time 15 -o /dev/null -w '%{http_code}' https://amanikah.com/api/amanikah/me/family/brief)
[[ "$WALI_STATUS" == 401 ]] || { echo WALI_BRIEF_ROUTE_EXPOSED_OR_MISSING; exit 1; }
curl -fsS --max-time 15 -o /dev/null https://amanikah.com/account/family.html
# Real transactional mail smoke — fails the release if inbox delivery is broken.
if [[ "$MAIL_SKIP" != "1" ]]; then
  docker exec amanikah-api python -c "import os; from server import Mailer; c=dict(os.environ); m=Mailer(c); r=m.send(c.get('OPERATOR_EMAIL',''),'Amanikah deployment smoke test','Production API deployed. This message tests transactional email.'); assert r.get('ok'), r.get('code','delivery failed')"
else
  echo "EMAIL_SMOKE_SKIPPED — configure OPERATOR_EMAIL + Resend/SMTP, then retest delivery"
fi
trap - ERR
echo "DEPLOYMENT_COMPLETE_$NOW"
echo "Backups retained at $BACKUPS; confirm operator inbox and signed-in flow."
echo "ops.env was not replaced. MATCHMAKING_LIVE and billing sandbox remain operator-controlled."
