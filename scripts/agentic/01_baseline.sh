#!/usr/bin/env bash
# scripts/agentic/01_baseline.sh — Stage 0: record the baseline. Read-only.
source "$(dirname "$0")/00_env.sh"
echo "== git =="
git status --short | head -50
git branch --show-current
git log -10 --oneline
git remote -v
echo "== stack =="
node -v; pnpm -v
node -e "const p=require('./package.json');console.log('monorepo',p.version,'packageManager',p.packageManager)"
node -e "const p=require('./apps/web/package.json');console.log('web next',p.dependencies.next,'react',p.dependencies.react,'prisma',p.dependencies['@prisma/client'])"
echo "== guards (dependency-free, same steps as CI 'guards' job) =="
for s in verify-business-facts verify-migrations verify-pricing-source verify-claims verify-topic-map verify-link-density verify-legal verify-key-handlers verify-assistant audit-ai-discoverability verify-agentic; do
  printf '%-28s ' "$s"; if node "scripts/$s.mjs" >/dev/null 2>&1; then echo PASS; else echo FAIL; fi
done
printf '%-28s ' "old-domain-check"; node scripts/build-old-domain-redirects.mjs --check >/dev/null 2>&1 && echo PASS || echo FAIL
