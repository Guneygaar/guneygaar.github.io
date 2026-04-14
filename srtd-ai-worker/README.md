# srtd-ai Worker — Deployment

Single Cloudflare Worker that fronts the Anthropic API for every AI
feature in Sorted. Gated per-workspace via `workspace_settings.ai_*`
flags, logs every call to the `ai_usage` table.

## First-time setup

```
cd srtd-ai-worker
npm install    # if wrangler is not already installed globally
```

## Set secrets (run once)

```
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put AI_SECRET
```

Use value `srtd-ai-2026xK9mN3pQ` for `AI_SECRET` (must match
`window.AI_CONFIG.secret` in `ai-config.js`).

## Deploy

```
wrangler deploy
```

## After deploy

Upload the brand guide to R2:

- Key: `ai/brand-guide.txt`
- Content: paste the GBL brand guide text
- Bucket: `sorted-images`

This file is optional. If it is missing, the Worker falls back to the
approved-posts context only and still works.

## SQL migrations to run in Supabase before using AI features

Run in order in the Supabase SQL editor:

1. `sql/003-posts-ai-columns.sql`
2. `sql/004-ai-usage-table.sql`

The `workspace_settings` table already exists and has been created
manually — do NOT create it again.

## Routes

- `OPTIONS *`          → CORS preflight (204)
- `POST /ai/complete`  → main AI completion endpoint
- `POST /ai/log`       → lightweight standalone usage logger
- anything else        → 404

Every POST must include the header `X-AI-Secret: <AI_SECRET>`.

## Secrets / bindings summary

| Name                | Type   | Where set                       |
|---------------------|--------|---------------------------------|
| `ANTHROPIC_API_KEY` | secret | `wrangler secret put`           |
| `AI_SECRET`         | secret | `wrangler secret put`           |
| `SORTED_IMAGES`     | R2     | `wrangler.toml` (`sorted-images`) |

Supabase URL + service-role key are hardcoded in `src/index.js`,
matching the pattern already used by `sorted-preview-worker`.
