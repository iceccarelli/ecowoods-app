#!/usr/bin/env bash
# scripts/agentic/00_env.sh — shared environment for the agentic command manifest.
# Source it: `source scripts/agentic/00_env.sh`. Never prints a secret.
set -euo pipefail
export SITE_URL="${SITE_URL:-https://ecowoods.ca}"
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-$SITE_URL}"
export NEXT_TELEMETRY_DISABLED=1
export TURBO_TELEMETRY_DISABLED=1
# The build must not depend on real secrets (see .github/workflows/web.yml).
export DATABASE_URL="${DATABASE_URL:-postgresql://user:pass@localhost:5432/db?schema=ecowoods}"
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"
export NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-local-placeholder-not-a-real-secret}"
export NEXTAUTH_URL="${NEXTAUTH_URL:-$SITE_URL}"
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
