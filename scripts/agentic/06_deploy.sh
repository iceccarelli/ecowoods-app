#!/usr/bin/env bash
# scripts/agentic/06_deploy.sh — Stage 44. Production deploys from GitHub main via Vercel.
#
# This script does NOT push on its own. Merging to main is the deploy, and the
# repository's own tool for that is scripts/ship.sh (apply → verify → commit →
# push → prove origin/main moved). Run it from a machine with GitHub push
# rights, after 03 and 04 are green:
#
#   git checkout feat/agentic-primitives-v2
#   bash scripts/ship.sh --check                 # verify only
#   git checkout main && git merge --no-ff feat/agentic-primitives-v2
#   git push origin main                         # Vercel builds and promotes
#
# Alternatively, from the Vercel CLI with a linked project: `vercel --prod`.
# Then run 07_verify-production.sh. Do not trust the deploy log; probe.
source "$(dirname "$0")/00_env.sh"
echo "Deploy = push to origin/main (Vercel auto-deploys). See the header of this script."
echo "Branch: $(git branch --show-current)  HEAD: $(git rev-parse --short HEAD)"
git status --short | head -20
