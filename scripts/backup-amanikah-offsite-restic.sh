#!/usr/bin/env bash
# Encrypted off-site backup and isolated restore check for Amanikah private data.
# Operator must configure /root/amanikah-backup/restic.env (mode 600) with:
# RESTIC_REPOSITORY=s3:... (or sftp:, rest:, rclone:, b2:, azure:)
# RESTIC_PASSWORD_FILE=/root/amanikah-backup/restic-password
# plus storage-provider credentials where required. No credentials in GitHub.
# Prerequisites on VPS: restic, docker, python3. Never writes into public webroot.
set -Eeuo pipefail
umask 077
if [[ "$(id -u)" -ne 0 ]]; then echo "ROOT_REQUIRED" >&2; exit 1; fi
CONFIG="${AMANIKAH_BACKUP_CONFIG:-/root/amanikah-backup/restic.env}"
[[ -f "$CONFIG" && -O "$CONFIG" ]] || { echo "BACKUP_CONFIG_MISSING_OR_NOT_OWNED" >&2; exit 1; }
# shellcheck disable=SC1090
source "$CONFIG"
: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY must be configured}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE must be configured}"
case "$RESTIC_REPOSITORY" in
  s3:*|sftp:*|rest:*|rclone:*|b2:*|azure:*) ;;
  *) echo "OFFSITE_REPOSITORY_REQUIRED" >&2; exit 1;;
esac
[[ -r "$RESTIC_PASSWORD_FILE" ]] || { echo "RESTIC_PASSWORD_FILE_UNREADABLE" >&2; exit 1; }
command -v restic >/dev/null
command -v docker >/dev/null
command -v python3 >/dev/null
docker ps --format '{{.Names}}' | grep -qx 'amanikah-api' || { echo "AMANIKAH_API_NOT_RUNNING" >&2; exit 1; }
WORK="$(mktemp -d /root/amanikah-private-backup.XXXXXXXX)"
CONTAINER_DB="/data/.restic-amanikah-snapshot-$$.sqlite"
cleanup(){
  docker exec amanikah-api rm -f "$CONTAINER_DB" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT
# SQLite online backup is consistent while the service runs.
docker exec amanikah-api python -c 'import sqlite3,sys; src=sqlite3.connect("/data/amanikah.sqlite"); dst=sqlite3.connect(sys.argv[1]); src.backup(dst); dst.close(); src.close()' "$CONTAINER_DB"
docker cp "amanikah-api:$CONTAINER_DB" "$WORK/amanikah.sqlite"
if docker exec amanikah-api sh -c 'test -d /data/private_voice'; then
  docker cp "amanikah-api:/data/private_voice" "$WORK/private_voice"
else
  mkdir -m 700 "$WORK/private_voice"
fi
python3 - "$WORK/amanikah.sqlite" <<'PY'
import sqlite3,sys
with sqlite3.connect("file:"+sys.argv[1]+"?mode=ro",uri=True) as db:
    assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
print("LOCAL_SQLITE_SNAPSHOT_INTEGRITY_OK")
PY
# restic encrypts contents before writing to the configured offsite repository.
restic backup --tag amanikah-private "$WORK/amanikah.sqlite" "$WORK/private_voice"
SNAPSHOT="$(restic snapshots --json --tag amanikah-private --latest 1 | python3 -c 'import json,sys; v=json.load(sys.stdin); assert v; print(v[0]["id"])')"
[[ -n "$SNAPSHOT" ]] || { echo "NO_ENCRYPTED_SNAPSHOT_FOUND" >&2; exit 1; }
RESTORE="$WORK/restore"
mkdir -m 700 "$RESTORE"
restic restore "$SNAPSHOT" --target "$RESTORE" >/dev/null
RESTORED_DB="$(find "$RESTORE" -name amanikah.sqlite -type f -print -quit)"
[[ -s "$RESTORED_DB" ]] || { echo "RESTORED_SQLITE_NOT_FOUND" >&2; exit 1; }
python3 - "$RESTORED_DB" <<'PY'
import sqlite3,sys
with sqlite3.connect("file:"+sys.argv[1]+"?mode=ro",uri=True) as db:
    assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    assert db.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'").fetchone()[0] > 0
print("OFFSITE_ENCRYPTED_RESTORE_DRILL_OK")
PY
echo "ENCRYPTED_OFFSITE_BACKUP_AND_RESTORE_VERIFIED"
