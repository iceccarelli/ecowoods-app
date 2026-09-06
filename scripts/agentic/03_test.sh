#!/usr/bin/env bash
# scripts/agentic/03_test.sh — every gate that does not need the network:
# the 51-guard verify chain, the typecheck, and the vitest suites
# (golden queries, negative, API contract, registry invariants, drift, schema, security).
source "$(dirname "$0")/00_env.sh"
pnpm verify
pnpm --filter @ecowoods/web exec tsc --noEmit
pnpm --filter @ecowoods/web test
