# Amanikah production security & consent audit — 17 November 2026

**Release purpose:** make the existing early-access platform more robust and build a non-coercive, double-opt-in introduction flow for a FUTURE launch. The service is **NOT** operational live matchmaking. Email verification, off-site restore and staffed safeguarding still block commercial launch.

## Issues reproduced by source review and hardened

| Risk | Impact before patch | Mitigation in this release | Regression evidence |
|---|---|---|---|
| Untrusted X-Forwarded-For | Caller-controlled client IP could evade request limits | Honor forwarded IP **only from explicitly trusted proxy CIDRs**, validate address, otherwise use TCP peer | `test_launch_security.py` spoofed-header cases |
| Shared SQLite connection across HTTP threads | Concurrent requests could share/overlap transactions on one `check_same_thread=False` connection | One SQLite connection per request thread, WAL and busy timeout, close on finished request | 12 concurrent support writes in `test_launch_matchmaking.py` |
| Frontend-only signup disablement | API continued creating unverified accounts despite mail being off | HTTP register returns 503 without mail; test-only override works only on 127.0.0.1 | `test_launch_security.py`, integration fixture |
| Withdrawn consent left usable account token | Existing session could still read /me | Purge private information, invalidate sessions immediately, reject login/reuse after withdrawn consent | HTTP integration test |
| Admin could mark a case “mutual” unilaterally | False consent claim; potentially unsafe introduction | Server-validated eligibility for **two verified adults**, independent acceptances; irreversible pause after decline/withdrawal; no peer details exposed | `test_launch_matchmaking.py` and member UI smoke |
| Matching flag alone unlocked workflow | Future accidental launch without operational readiness | API and VPS release both require safety review, offsite restore and real-account QA signoffs. Email-skip forbids matching | Match preflight tests and release checks |
| Open analytics allowed arbitrary properties | Sensitive texts could be stored by arbitrary keys | Positive allowlist; filter email, phone-like strings and unknown keys; rate limit events | Security tests |
| GET email-verification side effect | Email scanners could consume tokens | Verification is POST-only; browser removes token from displayed URL, `no-referrer` | HTTP and static checks |
| Malformed JSON arrays/negative length | Public endpoints could raise errors | Parse and accept only JSON objects (length limited); invalid inputs return 400 | HTTP integration tests |
| Invite scopes accepted nested input | Unhashable list/dict values could trigger 500 | Validate scopes as plain, enumerated strings, require actual boolean accept/decline | Family module tests |
| Rate limiter client map grows indefinitely | Excessive unique-client requests could consume memory | Bounded key count and periodic expired-key pruning | Unit check |
| API response headers | Basic client content-type/referrer hardening missing | Add no-store, nosniff, no-referrer, frame deny | HTTP check |

### Matching state machine
- Operator may create **draft** case records. Drafts are never matches; creating them does not imply an introduction.
- When the actual production flags and operations approval are all present, an operator can open a case **only between two real adults** with verified email, 21+ profile age and current consent; a block on either side prevents opening.
- Each adult sees only their own invitation reference, date and status; no other party's identity, location, contact details, Wali Brief or voice message is disclosed.
- Each adult must independently `accept` before the operator may mark **mutual**. A `decline` pauses the case. A paused or closed case cannot be reopened to bypass consent.
- If an adult withdraws consent or deletes their account, affected cases become paused and their acceptance records are removed.
- `GET /api/amanikah/me/introductions` and `POST /api/amanikah/me/introductions/<case_id>/respond` remain gated off while not live.
- Operator controls explicitly say **Create private draft**; member controls only show after launch gates pass.

**Important:** a mutual case is STILL not authorization to share a name, phone number, mosque, photo, transcript or other identifying data; a further explicit, audited disclosure workflow, qualified staff review and safeguarding rules are needed before the first real introduction. The current code intentionally does not implement peer-identity disclosure or open messaging.

### Deploy and proxy details
Caddy's reverse proxy documentation says it ignores untrusted client-supplied X-Forwarded-* headers by default. The Python API nevertheless needs an explicit list of **actual trusted upstream proxy IPs** to accept forwarded client addresses:
`AMANIKAH_TRUSTED_PROXY_CIDRS=<exact_caddy_internal_address>/32` (IPv4) or /128 (IPv6), in the private VPS `/root/amanikah-api/ops.env`.
Verify the value using Docker network inspection, never invent a CDN or broad bridge subnet. If absent, the application safely uses the socket source address, which may aggregate users behind one reverse proxy and require tuning for scale.

Current production flags must remain:
```text
WAITLIST_MODE=1
MATCHMAKING_LIVE=0
AMANIKAH_AI_ENABLED=0
```
Groq Al Wali is a **separate** opt-in service governed by its own configuration. Do not enable paid services or donor payments as a side effect of this release.

### STILL NOT VERIFIED — do not claim production-ready matching
1. **New-account identity and recovery:** transactional verification mail is intentionally off. Real account onboarding/recovery cannot be done at scale; phone verification and fraud/impersonation review are not implemented.
2. **Emergency/safety operations:** named primary+backup operator, urgent-report response drills and harassment/coercion escalation are not verified. A queue is not moderation.
3. **Disaster recovery:** only local pre-release snapshots are confirmed. Off-site encrypted restic destination, successful restore drill and enforceable expiry/deletion schedule remain unverified.
4. **Three-account production acceptance:** no real human A/B/C test of mutual introduction/decline/block, family scope, account withdrawal or recordings; only isolated synthetic automated tests.
5. **Independent penetration test and external security review:** this is a source-code and automated QA hardening pass, not a guarantee that every vulnerability is gone.
6. **Identity disclosure rules:** no member contact exchange or picture/biodata sharing until a carefully scoped, separately consented workflow with real staff oversight is approved.
7. **Regulatory and service legal:** India-qualified legal review of DPDP, consumer disclosures, waqf/charity restrictions, payments, grievance handling, international data processing and retention is still required.

### Standards and documentation
- OWASP API Security Top 10: https://owasp.org/www-project-api-security/
- OWASP ASVS 5.0 Session Management: https://github.com/OWASP/ASVS/blob/master/5.0/en/0x16-V7-Session-Management.md
- Python SQLite concurrency: https://docs.python.org/3/library/sqlite3.html
- Caddy trusted forwarded headers: https://caddyserver.com/docs/caddyfile/directives/reverse_proxy
- India's notified DPDP commencement gazette (13 Nov 2025): https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf
