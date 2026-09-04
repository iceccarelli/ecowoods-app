# Ecowoods — apply the entity-excellence patch from the Codespaces terminal
# 1. Upload ecowoods-entity-excellence-2026-09-04.patch to the repo root (drag it into the Explorer), then:

cd "$(git rev-parse --show-toplevel)"
git checkout main && git pull --ff-only
git checkout -b fix/entity-excellence-and-modernization
git apply --check ecowoods-entity-excellence-2026-09-04.patch
git am --keep-cr ecowoods-entity-excellence-2026-09-04.patch      # applies with the commit message
rm -f ecowoods-entity-excellence-2026-09-04.patch                  # verify:hygiene refuses a .patch at the root

pnpm install --frozen-lockfile
pnpm verify                                                        # 50 guards — must print 50 ✓
pnpm build

git push -u origin fix/entity-excellence-and-modernization
gh pr create --fill --title "Entity excellence: one identity, positive public copy, sourced reviews" \
  --body "Ecowoods Hardwood Flooring Inc. → https://ecowoods.ca. /reviews rewritten, machine files positive and sourced, HomeStars 2897115 wired (owner-confirmed), 66 legacy .md records retired, README = live state 2026-09-04. pnpm verify 50/50."

# After the Vercel deploy is live:
pnpm seo:live            # live domain redirect + crawl
pnpm notify:indexnow     # tell Bing/IndexNow the canonicals changed
