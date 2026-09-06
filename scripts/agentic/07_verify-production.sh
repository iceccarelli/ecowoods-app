#!/usr/bin/env bash
# scripts/agentic/07_verify-production.sh — Stage 45: probe PRODUCTION, not the log.
# Every critical route incl. machine files and /api/v1 primitives: status,
# content-type, final URL, canonical, ETag/304, JSON-LD validity, fact validity.
# Plus the repository's own live checks (old domain, stale hosts, crawl).
source "$(dirname "$0")/00_env.sh"
node scripts/verify-production-agentic.mjs --base "$SITE_URL" --strict
bash scripts/verify-live.sh "$SITE_URL" || true
pnpm seo:hosts || true
pnpm seo:domain || true
