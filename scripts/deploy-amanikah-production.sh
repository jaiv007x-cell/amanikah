#!/usr/bin/env bash
# Amanikah release runner. Requires root; run only after GitHub QA and review.
set -Eeuo pipefail
umask 077
if [[ $(id -u) -ne 0 ]]; then echo ROOT_REQUIRED; exit 1; fi
if [[ -z "$RELEASE_ROOT" || ! -d "$RELEASE_ROOT/site" ]]; then echo INVALID_RELEASE; exit 1; fi
APP_DIR=/root/amanikah-api
SITE_DIR=/var/www/amanikah
ENV_FILE="$APP_DIR/ops.env"
[[ -f "$RELEASE_ROOT/api/private_features.py" && -f "$RELEASE_ROOT/api/server.py" ]] || { echo INVALID_RELEASE; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo MISSING_VPS_OPS_ENV; exit 1; }
grep -Eq '^OPERATOR_EMAIL=[^[:space:]]+@[^[:space:]]+' "$ENV_FILE" || { echo OPERATOR_EMAIL_NOT_CONFIGURED; exit 1; }
if ! grep -Eq '^RESEND_API_KEY=[^[:space:]]+' "$ENV_FILE" && ! grep -Eq '^SMTP_HOST=[^[:space:]]+' "$ENV_FILE"; then
 echo TRANSACTIONAL_MAIL_NOT_CONFIGURED; exit 1
fi
[[ -d "$SITE_DIR" ]] || { echo SITE_DIR_MISSING; exit 1; }
command -v rsync >/dev/null
command -v docker >/dev/null
command -v curl >/dev/null
NOW=$(date -u +%Y%m%dT%H%M%SZ)
BACKUPS="$APP_DIR/backups"
install -d -m 700 "$BACKUPS"
tar -C /var/www -czf "$BACKUPS/site-$NOW.tar.gz" amanikah
for f in server.py private_features.py docker-compose.yml Dockerfile; do
 if [[ -f "$APP_DIR/$f" ]]; then cp -p "$APP_DIR/$f" "$BACKUPS/$f.$NOW"; fi
done
if docker ps --format '{{.Names}}' | grep -qx 'amanikah-api'; then
 docker exec amanikah-api python -c "import sqlite3; a=sqlite3.connect('/data/amanikah.sqlite'); b=sqlite3.connect('/data/pre-release-$NOW.sqlite'); a.backup(b); b.close(); a.close()"
 docker cp "amanikah-api:/data/pre-release-$NOW.sqlite" "$BACKUPS/db-$NOW.sqlite"
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
rsync -a "$RELEASE_ROOT/site/" "$SITE_DIR/"
install -m 600 "$RELEASE_ROOT/api/server.py" "$APP_DIR/server.py"
install -m 600 "$RELEASE_ROOT/api/private_features.py" "$APP_DIR/private_features.py"
install -m 600 "$RELEASE_ROOT/api/Dockerfile" "$APP_DIR/Dockerfile"
install -m 600 "$RELEASE_ROOT/api/docker-compose.yml" "$APP_DIR/docker-compose.yml"
cd "$APP_DIR"
docker compose config -q
docker compose up -d --build api
sleep 3
curl -fsS --max-time 15 https://amanikah.com/api/amanikah/health | python -c "import json,sys; d=json.load(sys.stdin); assert d['ok'] is True"
curl -fsS --max-time 15 -o /dev/null https://amanikah.com/images/film/amanikah-story-30s.mp4
VOICE_STATUS=$(curl -s --max-time 15 -o /dev/null -w '%{http_code}' https://amanikah.com/api/amanikah/me/voice)
[[ "$VOICE_STATUS" == 401 ]] || { echo PRIVATE_VOICE_ROUTE_EXPOSED; exit 1; }
docker exec amanikah-api python -c "import os; from server import Mailer; c=dict(os.environ); m=Mailer(c); r=m.send(c.get('OPERATOR_EMAIL',''),'Amanikah deployment smoke test','Production API deployed. This message tests transactional email.'); assert r.get('ok'), r.get('code','delivery failed')"
trap - ERR
echo "DEPLOYMENT_COMPLETE_$NOW"
echo "Backups retained at $BACKUPS; confirm operator inbox and signed-in flow."
