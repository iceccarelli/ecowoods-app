#!/usr/bin/env bash
# scripts/agentic/05_validate.sh — validate the BUILT output locally before any deploy:
# start `next start`, probe every machine surface and the /api/v1 primitives,
# check status, content-type, ETag/304, JSON-LD well-formedness and fact parity
# against the constants. Same probe as 07 against localhost.
source "$(dirname "$0")/00_env.sh"
PORT="${PORT:-3123}"
( cd apps/web && npx next start -p "$PORT" >/tmp/ecowoods-next-start.log 2>&1 ) &
NEXT_PID=$!
trap 'kill $NEXT_PID 2>/dev/null || true' EXIT
for i in $(seq 1 60); do curl -sf "http://127.0.0.1:$PORT/api/v1/manifest" >/dev/null 2>&1 && break; sleep 1; done
node scripts/verify-production-agentic.mjs --base "http://127.0.0.1:$PORT" --strict
