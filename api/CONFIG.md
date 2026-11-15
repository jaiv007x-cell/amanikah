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
