# Amanikah

Public source mirror of [amanikah.com](https://amanikah.com/) — a Muslim matrimonial product (early access).

## Layout

| Path | Contents |
|---|---|
| `site/` | Production static site served at amanikah.com |
| `api/` | Python API (`amanikah-api`, port 8090) |
| `billing/` | Billing sandbox service |
| `docs/` | Audit / recovery reports |

## Important

- **Matchmaking is not live** (`MATCHMAKING_LIVE=0`).
- **Billing is sandbox** until fulfillment is ready.
- Secrets (`ops.env`, DB files, API keys) are **not** in this repository — use `api/ops.env.example`.
- Film clips on the homepage are **AI-illustrated** until live-action assets replace them.

## Local notes

See `api/CONFIG.md` and `api/ops.env.example` for environment flags.
