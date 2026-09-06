#!/usr/bin/env bash
# scripts/agentic/02_install.sh — install exactly the lockfile, generate the Prisma client.
source "$(dirname "$0")/00_env.sh"
pnpm install --frozen-lockfile
pnpm --filter @ecowoods/web exec prisma generate
