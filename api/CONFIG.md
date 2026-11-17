# Amanikah platform API — configuration

Service: `amanikah-api` on Docker network `airrates_edge`, port `8090`.
Public path: `https://amanikah.com/api/amanikah/*` (Caddy reverse proxy).
Env file: `/root/amanikah-api/ops.env` (mode `600`). Example: `ops.env.example`.

## Required

| Variable | Purpose |
|---|---|
| `OPS_ADMIN_TOKEN` | Bearer/token for `/api/amanikah/ops/*` and the `/ops/` console (`X-Ops-Token` header). |
| `SESSION_PEPPER` | Pepper for password hashing (64 hex chars recommended). |
| `AMANIKAH_DB` | SQLite path inside the container (`/data/amanikah.sqlite`). |
| `PORT` | `8090`. |

## Operator email (transactional)

Set **one** provider. Until configured, accepted leads/tickets still persist; notifications stay in the outbox with status `queued` and are never silently discarded.

### Option A — Resend

1. Create an API key at https://resend.com
2. Verify a sending domain (e.g. `amanikah.com`)
3. Set in `ops.env`:
   - `RESEND_API_KEY=re_...`
   - `MAIL_FROM=Amanikah <noreply@your-verified-domain>`
   - `OPERATOR_EMAIL=you@your-domain`

### Option B — SMTP

1. Use any SMTP mailbox that can send to the operator
2. Set:
   - `SMTP_HOST`, `SMTP_PORT` (usually `587`), `SMTP_USER`, `SMTP_PASS`, `SMTP_TLS=1`
   - `MAIL_FROM=...`
   - `OPERATOR_EMAIL=...`

Restart after edits:

```bash
cd /root/amanikah-api && docker compose up -d --force-recreate
```

## Al Wali public assistant (Groq, optional)

The guided floating assistant works immediately with no provider key at `/api/amanikah/al-wali/status` and `/api/amanikah/al-wali/chat`.

To enable optional AI **after** assessing the provider's data controls:

1. In the VPS's private `/root/amanikah-api/ops.env` (never in GitHub), set `GROQ_API_KEY=gsk_...`.
2. Optionally set `GROQ_MODEL=openai/gpt-oss-20b` (currently recommended production model). It defaults to that model if unset.
3. Restart only the Amanikah API: `cd /root/amanikah-api && docker compose up -d --force-recreate api`.
4. Check `curl -fsS https://amanikah.com/api/amanikah/al-wali/status` for `"aiAvailable":true`. Never print the real key.
5. In Groq Console → Data Controls, consider enabling Zero Data Retention; review its jurisdiction, processor terms and retention policy for your users.
6. If AI should be off, set `AMANIKAH_WALI_AI_ENABLED=0` and recreate the API container. The free guided mode continues working.

The presence of the key enables **only** the Al Wali AI feature; visitors must also actively select the AI switch. Public questions and previous six text messages are sent only with that choice. No profile or voice media is read, no server chat database is created, and the private Family Assistant remains separately governed by `AMANIKAH_AI_ENABLED` and `OPENAI_API_KEY`.

Al Wali is not a fatwa service or marriage-suitability score. Rate limits are enforced on the server with a no-network fallback. The AI is not a human wali.

## Product flags

- `WAITLIST_MODE=1` — public signup labeled waitlist (recommended until matchmaking is live).
- `MATCHMAKING_LIVE=0` — do not claim live introductions.
- `PUBLIC_BASE_URL=https://amanikah.com` — used in verification links.

## Payments

Real card capture stays off. Billing continues on `/api/billing` in **sandbox** until services are deliverable. Configure Razorpay live keys only when fulfillment is real; keep sandbox orders separate.

## Operator console

1. Open `https://amanikah.com/ops/`
2. Paste `OPS_ADMIN_TOKEN`
3. Manage lead statuses: new → contacted → qualified → converted → closed
4. Review support vs safety tickets, introduction cases, verification requests, fulfillment, and notification outbox

## Production membership

- Public demo SPA: `/register`, `/login` (localStorage; never auto-migrated)
- Production accounts: `/account/register.html`, `/account/login.html`
- Verify email via link (or operator outbox when mail is unset), then sign in

## Deploy checklist

```bash
cd /root/amanikah-api && docker compose up -d --force-recreate
docker run --rm -v /root/L/deploy/Caddyfile:/etc/caddy/Caddyfile:ro caddy:2.8-alpine \
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
cd /root/L && docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate caddy
curl -sk --resolve amanikah.com:443:127.0.0.1 https://amanikah.com/api/amanikah/health
```
