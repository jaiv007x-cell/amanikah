#!/usr/bin/env bash
# Deploy only Amanikah's static website from this VPS's read-only GitHub key.
# Does NOT restart Docker, write ops.env, touch databases, or alter AirRates.
set -Eeuo pipefail
umask 077
mode="${1:---dry-run}"
if [[ "$mode" != "--apply" && "$mode" != "--dry-run" ]]; then echo "Usage: $0 [--dry-run|--apply]"; exit 2; fi
SITE_DIR=/var/www/amanikah
REMOTE=git@github.com-amanikah:jaiv007x-cell/amanikah.git
BACKUP_DIR=/var/backups/amanikah-site
command -v git >/dev/null; command -v rsync >/dev/null; command -v tar >/dev/null
[[ -d "$SITE_DIR" ]] || { echo "Site tree not found: $SITE_DIR"; exit 1; }
temp="$(mktemp -d /tmp/amanikah-static.XXXXXXXX)"
trap 'rm -rf "$temp"' EXIT
# Clone as invoking user so ~/.ssh/config and ~/.ssh/amanikah_deploy remain valid.
git ls-remote "$REMOTE" refs/heads/main >/dev/null || { echo "GitHub VPS deploy key not yet working"; exit 1; }
git clone -q --depth=1 --branch main "$REMOTE" "$temp/repo"
test -s "$temp/repo/site/index.html"
test -s "$temp/repo/site/css/finish-2026.css"
test -s "$temp/repo/site/icon.svg"
test -s "$temp/repo/site/images/film/amanikah-story-30s.mp4"
grep -q 'A simple, respectful start' "$temp/repo/site/index.html"
grep -q 'story-outside-disclosure' "$temp/repo/site/index.html"
sha="$(git -C "$temp/repo" rev-parse HEAD)"
echo "GitHub main: $sha"
echo "Static files to update:"
rsync -ani --exclude='.git' "$temp/repo/site/" "$SITE_DIR/" | sed -n '1,80p'
if [[ "$mode" != "--apply" ]]; then
  echo "DRY RUN ONLY. Re-run with --apply after confirming this is the intended commit."
  exit 0
fi
if [[ ! -w "$SITE_DIR" ]]; then
  command -v sudo >/dev/null || { echo "sudo required for site directory"; exit 1; }
  sudo -v
  prefix=(sudo)
else
  prefix=()
fi
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
"${prefix[@]}" install -d -m 700 "$BACKUP_DIR"
"${prefix[@]}" tar -C /var/www -czf "$BACKUP_DIR/amanikah-$timestamp.tar.gz" amanikah
restore(){
  echo "Static release failed; restoring site snapshot"
  "${prefix[@]}" tar -C /var/www -xzf "$BACKUP_DIR/amanikah-$timestamp.tar.gz" || true
}
trap restore ERR
"${prefix[@]}" rsync -a --exclude='.git' "$temp/repo/site/" "$SITE_DIR/"
"${prefix[@]}" test -s "$SITE_DIR/css/finish-2026.css"
"${prefix[@]}" test -s "$SITE_DIR/icon.svg"
"${prefix[@]}" cmp "$temp/repo/site/index.html" "$SITE_DIR/index.html"
"${prefix[@]}" cmp "$temp/repo/site/images/film/amanikah-story-30s.mp4" "$SITE_DIR/images/film/amanikah-story-30s.mp4"
trap - ERR
echo "STATIC_DEPLOY_COMPLETE: $sha"
echo "Backup: $BACKUP_DIR/amanikah-$timestamp.tar.gz"
echo "API/database untouched. Validate https://amanikah.com/ separately; browser/CDN caching may delay visibility."
