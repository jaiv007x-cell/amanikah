# Amanikah early-access operations — release gate and incident runbook

Updated 17 November 2026. **Current stage: early-access website only.** Protected Family Studio/Voice/Wali Brief code exists, but no active matchmaking, no live payments, no verified mosque partners, and no registered charitable programme.

## Human operations must be staffed
Before soliciting significant traffic, designate a **named primary operator**, a named **backup operator**, and a genuine off-platform emergency escalation contact. Do not invent names or promise response times not supported by staffing.

**Daily at minimum (more frequently as traffic grows):**
1. Access `https://amanikah.com/ops/` using the server-held `OPS_ADMIN_TOKEN`; do not put token in issues or messenger.
2. Review **safety tickets first**; triage immediate risks, threats, coercion, extortion, impersonation, or shared intimate content. Use appropriate real-world emergency services when applicable. Keep notes restricted, factual, and need-to-know.
3. Review general support and community-interest tickets and the queued/failed notification outbox. Email is intentionally disabled; **no automatic alert or delivery is guaranteed**. Update statuses only after taking the actual action.
4. Review waitlist submissions; never treat waitlist entries as verified membership or approved matches.
5. Confirm API health, available disk space, new errors, and backup recency; report downtime through normal incident channels.
6. Log queue ownership and outstanding high-risk issues in a private operations system; avoid copying any member PII to public GitHub.

## Safety response
- Immediate threat: advise local emergency services. Amanikah is **not** an emergency hotline.
- Abuse/privacy report: preserve minimal evidence, revoke relevant sharing permissions where possible, assign a human reviewer and track to resolution. Do not attempt to infer sincerity or truth from voice.
- Coordinator concern: pause affected pilot or partner access; contact both adults privately where safe; assess conflicts of interest and procedural failures. No mosque partnership or coordinators are enabled yet.
- Finance: no donations, no payments. If any transfer is solicited in Amanikah's name, record as a possible impersonation/fraud report.

## Recoverable backups
The deployment runner already keeps local website and consistent SQLite snapshots, but **those are not disaster recovery if the VPS is lost**.

Prepared `scripts/backup-amanikah-offsite-restic.sh` uses the running API's SQLite online backup and private voice directory, uploads them encrypted through restic to a **configured remote** repository, restores the new snapshot to an isolated temp folder, and checks SQLite integrity. It does not overwrite live data.

**Still requires a human/operator to configure on the VPS:**
- An independently owned encrypted remote storage account with retention policy and least-privileged service credentials. Choose a provider and create `/root/amanikah-backup/restic.env` (root-only, mode 600), specifying `RESTIC_REPOSITORY`, `RESTIC_PASSWORD_FILE` and provider credentials; initialize the restic repository securely. Never commit credentials.
- Ensure `restic` is installed on the VPS and the independent encrypted repository is really external.
- Run the backup tool with root privileges. Confirm `ENCRYPTED_OFFSITE_BACKUP_AND_RESTORE_VERIFIED`, review provider storage/retention, and test a separate disaster-restore rehearsal on isolated infrastructure.
- Document recovery objectives and secure destruction/expiry of backups. Do not claim a backup retention number until a reviewed, enforceable policy exists.

## Real-member QA gate
The automated Python/HTTP tests use fresh synthetic accounts in a **temporary local database**, not real customers. Before broad launch, have authorized staff test on staging with Adult A, Adult B, and Unrelated C:
- registration and email verification (blocked while transactional email is disabled); never share production verification tokens publicly;
- signed-in-only Wali Brief and voice; C denied;
- invitation pending/accepted/new scope requires new acceptance; invitation declined, revoked or blocked immediately removes access;
- adult leaves an invitation; deleting a Wali Brief, audio, and account removes active records;
- accessibility and functionality on real Android/iPhone/desktop browsers.

Do not run invasive test registrations on production until user notification, deletion and incident procedures are available.

## Privacy and accessibility review
- Review private profile content, consent, erasure, safety reporting, incident notification, data minimization, third-party vendors, logs, backups and voice retention with India-qualified legal/privacy advisers.
- DPDP framework has phased commencement. Prepare now rather than assuming current deferral excuses insecure data handling.
- Check keyboard focus, contrast, 320px width, low-bandwidth devices, Hindi/Urdu copy, and reduced motion.
- Never represent mosque reference as identity/character proof. Do not disclose an individual's mosque, income, aid status, or family without explicit, revocable consent.

## Email-disabled operating posture
- Early-access waitlist and contact/safety forms remain active; accepted requests persist in the database and must be reviewed in the operator console.
- New member registration is paused in the browser until `mailConfigured=true`; server-side unverified accounts cannot use private features. Do not bypass that verification.
- Existing verified accounts can sign in, but password-reset/recovery email is not available; never handle passwords or verification URLs over public tickets.
- Keep `WAITLIST_MODE=1`, `MATCHMAKING_LIVE=0`, `AMANIKAH_AI_ENABLED=0`, billing sandbox until separate commercial readiness sign-off.

## Evidence required to mark phases complete
- Security: passing automated browser XSS regression and private API access tests, plus reviewed/merged code.
- Backup: actual output of remote encrypted backup and isolated restore, offsite location confirmed without leaking secrets.
- Human safety: named operator and backup, sample triage drill, documented response record.
- Pilot: signed community partner agreements and verified adult consent; zero public badges before evidence.
- Finance: separate legal and accounting review and permitted bank setup; zero charitable transfer until signed-off.
