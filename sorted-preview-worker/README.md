# srtd-og-inject Worker

Cloudflare Worker for WhatsApp preview generation.

## Current behaviour
Generates OG tags at request time by querying Supabase.
Fragile — being replaced with KV-based static generation.

## Planned behaviour (Phase 2)
Preview HTML generated at share-time in the app.
Stored in KV namespace: sorted-whatsapp-previews
Worker serves from KV only — no Supabase queries.

## KV Namespace
Name: sorted-whatsapp-previews
ID: 91e985ed81d5418eb4dfd4381aa2794d
Binding: PREVIEWS_KV

## Deploy
npx wrangler deploy
from sorted-preview-worker/ folder
