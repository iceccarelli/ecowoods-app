#!/usr/bin/env bash
# scripts/agentic/04_build.sh — the production build Vercel runs (see vercel.json).
source "$(dirname "$0")/00_env.sh"
pnpm --filter @ecowoods/web build
