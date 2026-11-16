# Amanikah — Wali Briefs & Release Operations (16 Nov 2026)

## Purpose and boundaries
A Wali Brief is written by its adult member. It is an optional, private guide for a mutually accepted conversation with a wali or trusted family member. It is **not** a verification, a fatwa, a compatibility score, or evidence of a person's character. Amanikah has not independently verified any of the statements.

A guest must have their own verified account. The member explicitly selects the **Wali Brief** permission when inviting that account, and the guest must accept the invitation before access works. Granting a new scope requires renewed acceptance; removal of a brief, revocation, account deletion, withdrawal of consent, or a member block stops further server access. The invited guest can also leave the invitation; former recipients may have retained copies outside Amanikah.

## Server routes (verified-member authentication)
- `GET /api/amanikah/me/family/brief` — member's own brief; never public
- `POST /api/amanikah/me/family/brief` — save `{"brief":{"marriageGoals":"...","familyExpectations":"...","livingPlans":"...","weddingExpectations":"...","questions":"..."}}`
- `POST /api/amanikah/me/family/brief/delete` — remove brief from active database
- `POST /api/amanikah/me/family/invite` — `"scopes":["wali_brief"]` (alongside independent city / intentions / voice scopes if desired)
- `POST /api/amanikah/me/family/respond` — invitee accepts (`accept:true`), declines, or leaves (`accept:false`)
- `POST /api/amanikah/me/family/revoke` — owner withdraws their invitation
- `GET /api/amanikah/me/family/shared/<owner-member-id>` — only fields authorized by accepted, unrevoked grant

The API returns 401 for unverified/unauthenticated callers and 403 for missing or revoked sharing permission. The UI uses textContent for displaying member text (never HTML injection). No brief content is sent to the AI provider or analytics.

## Production controls that must be satisfied
1. Keep `WAITLIST_MODE=1`, `MATCHMAKING_LIVE=0`, `AMANIKAH_AI_ENABLED=0`, and sandbox billing during the initial protected release.
2. Configure a monitored `OPERATOR_EMAIL` and a verified transactional Resend or SMTP sender in the VPS's existing `/root/amanikah-api/ops.env`; do not commit the file. Validate DNS at the provider and confirm real inbox receipt.
3. Run CI Python unit + HTTP integration tests and Playwright UI smoke. Staging exercise: two real verified accounts and an uninvolved third account; pending/accepted/new-scope/revoked/deleted/blocked flows all deny unauthorized access.
4. Back up the live SQLite database and private-voice volume before rollout. Implement encrypted off-server backups, published retention windows, and a documented restore drill. Deletion of a member removes records from the active DB, but backups are subject to the retention policy.
5. Confirm that named humans monitor the safety queue and can respond to a voice report, abuse report, data request, and opt-out. Establish escalation and incident response before live introductions.
6. Verify media upload validation, session expiry, 21+ account gate, account deletion, accessibility at 320/390/768/1440 widths, and that private pages are blocked without authentication.
7. Deploy only the tested `main` branch using the gated manual VPS release workflow or approved administrator SSH release; verify `/api/amanikah/me/family/brief` returns 401 when logged out, and the 42-second film plays muted at 1.0× with a pause button. Check real email delivery again after deployment.
8. Do **not** turn on matchmaking, live payments or optional AI from this release. Those are separate commercial, security, moderation and privacy launch decisions.

**Important:** Code in GitHub is not a production deployment. Until the operator inbox, VPS access, data backup/restore and human moderation gates are independently verified, the site remains early access and must not claim complete production readiness.
