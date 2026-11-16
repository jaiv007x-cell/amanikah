# Amanikah — controlled release runbook (16 Nov 2026)

## Current code status
- Working **draft PR #1**, not merged or deployed.
- 30-second illustrative film is committed at `site/images/film/amanikah-story-30s.mp4`; homepage video points to it, stays poster-first and user-controlled.
- Verified-account Family Studio, conditional AI guidance, scoped family invitations and private Voice Rishta API implemented.
- Voice WebM validation fixed and covered by HTTP tests; voice reporting and blocking included.
- GitHub workflows: `quality-gate.yml` (Python and full HTTP checks), `ui-smoke.yml` (Chromium tests), `build-film.yml` (asset build).
- Matchmaking remains OFF. Billing is still SANDBOX.

## Only two ways to go live
1. **Existing VPS**: do a manual release after QA, via `.github/workflows/manual-vps-release.yml` on `main` only, with `production` approval and VPS SSH secrets.
2. Manual administrator SSH release with `scripts/deploy-amanikah-production.sh` after checking the VPS configuration. Never paste SSH private keys, tokens or API secrets into ChatGPT.

## Required GitHub environment/repository secrets
Under GitHub repository **Settings → Secrets and variables → Actions**:
- `AMANIKAH_VPS_HOST`: actual VPS hostname/IP
- `AMANIKAH_VPS_USER`: administrator-capable SSH account
- `AMANIKAH_VPS_KEY`: deployment SSH private key
- `AMANIKAH_SSH_KNOWN_HOSTS`: trusted pinned SSH host public-key entry (confirm its fingerprint through your VPS control panel first; do not use a blind ssh-keyscan).

Workflow is **manual only**: Actions → Amanikah VPS release → Run workflow (branch `main`, confirmation `DEPLOY`). Never trigger against a draft PR.

## VPS application credentials — stored only in /root/amanikah-api/ops.env
- `OPERATOR_EMAIL`: a real inbox monitored by Amanikah
- Either `RESEND_API_KEY` or `SMTP_HOST, SMTP_USER, SMTP_PASS`
- `MAIL_FROM`: an address on a verified sending domain
- `SESSION_PEPPER` and `OPS_ADMIN_TOKEN`: existing secure production values
- `VOICE_PRIVATE_DIR=/data/private_voice` on persistent, backed-up private volume
- `MATCHMAKING_LIVE=0`
- `AMANIKAH_AI_ENABLED=0` initially; to offer actual AI responses, supply a permitted `OPENAI_API_KEY` and supported `AMANIKAH_AI_MODEL`, then turn on after safety review. An ordinary ChatGPT subscription is not an API credential.

For Resend, verify `amanikah.com` or a delegated sending subdomain inside the Resend dashboard; add the precise SPF/DKIM records Resend gives you; confirm verification and a human receipt. Do not guess DNS values.

## Release safety
The release script:
1. Aborts before changes if the operator email or mail provider is missing.
2. Creates a full static-site archive and a consistent SQLite backup.
3. Copies reviewed website/API code to existing paths and rebuilds the API container with ffprobe.
4. Validates API health, film URL, and private voice route (expects 401 without login).
5. Sends a real mailer smoke-test message to configured operator inbox.
6. Attempts to restore site/code and restart previous API on release failure.

**Limitation:** rollback is best-effort and does not undo SQLite schema migrations; these changes are additive. Validate on staging or with backups before using real member data.

## Post-deploy verification
- Confirm human receipt of mailer smoke test.
- Register two fresh verified staging accounts using real email delivery. Confirm password verification and private session.
- Adult A invites Adult B to see only selected scopes; B accepts and can see only permitted fields/voice.
- Revoke access, then check B receives 403 immediately. Check a third member sees 403.
- Test upload/play/delete of 30–45 sec voice, plus invalid media, >60-sec and >2-MB rejection.
- Test report voice → safety ticket and block member → access denied.
- Explicit AI consent OFF => guided rules-only questions; consent ON, configured AI => generated answer without automatic private-profile forwarding.
- Test account deletion and consent withdrawal, confirming voice/grants are purged.
- Test homepage and 320/390/768/1440px layout, loading of 30s MP4 without autoplay.
- Validate actual operator response procedure and data/voice backup retention.
- Do not enable matchmaking or real payments until separate operational reviews.

## Explicit blockers we cannot supply from GitHub
VPS SSH authorization, real operator email inbox, confirmed Resend/SMTP configuration and credentials, AI API key/model/permission, and human review of live audio moderation reports. No live launch is claimed until those are configured and independently tested.
