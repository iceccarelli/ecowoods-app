#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# apply-section-reorder.sh
#
# Reorders the landing-page sections into a research-backed narrative:
#
#   Hero -> Services -> Gallery -> Process -> Configurator+Specs -> Reviews
#        -> FAQ -> Quote
#
# WHY (2026 conversion research, PAS framework, Unbounce +22% over feature-lists):
#   - SOLUTION before PROOF: state what makes you different (Services), THEN show
#     the result (Gallery). "What we do" then "what you get".
#   - Gallery moved UP from #5: transformation imagery is the strongest trust
#     asset, and <22% of visitors reach the old position.
#   - Reviews moved DOWN to #6: testimonials land hardest at the friction point,
#     right before the ask. Early proof is already carried by the hero stats.
#   - FAQ -> Quote kept adjacent: clear objections immediately before the CTA.
#
# It reorders by parsing the comment-banner blocks, NOT line numbers, so it
# applies regardless of drift. Idempotent: if already in the target order, it
# reports so and changes nothing. Run from repo root.
# ---------------------------------------------------------------------------
set -euo pipefail
[ -f apps/web/app/page.tsx ] || { echo "ERROR: run from the repo root"; exit 1; }

python3 - << 'PY'
import re, sys
p = 'apps/web/app/page.tsx'
s = open(p).read()

# Already reordered? Services should come before Reviews in the DOM.
def pos(pat):
    m = re.search(pat, s); return m.start() if m else -1

svc, rev, gal = pos(r'id="services"'), pos(r'id="reviews"'), pos(r'id="gallery"')
if svc == -1 or rev == -1 or gal == -1:
    sys.exit("ERROR: expected sections not found (services/reviews/gallery)")

if svc < gal < rev:
    print("  = already in target order — no change")
    sys.exit(0)

region_start = pos(r'\{/\* 2 · PROOF')
region_end   = pos(r'\{/\* 6 · CONVERSION')
if region_start == -1 or region_end == -1 or region_start >= region_end:
    sys.exit("ERROR: reorder region markers not found — page structure differs; tell Claude")

head, region, tail = s[:region_start], s[region_start:region_end], s[region_end:]

markers = [
    ('reviews',  r'\{/\* 2 · PROOF'),
    ('services', r'\{/\* 3 · THE ECOWOODS STANDARD'),
    ('process',  r'\{/\* 4 · HOW IT WORKS'),
    ('gallery',  r'\{/\* 5 · RESULTS'),
    ('desire',   r'\{/\* 5b · DESIGN YOUR FLOOR'),
    ('faq',      r'\{/\* Objection-handling FAQ'),
]
found = []
for name, pat in markers:
    m = re.search(pat, region)
    if not m:
        sys.exit(f"ERROR: block '{name}' banner not found — tell Claude")
    found.append((name, m.start()))
found.sort(key=lambda x: x[1])

blocks = {}
for i, (name, start) in enumerate(found):
    end = found[i+1][1] if i+1 < len(found) else len(region)
    blocks[name] = region[start:end]

NEW = ['services', 'gallery', 'process', 'desire', 'reviews', 'faq']
if set(NEW) != set(blocks):
    sys.exit(f"ERROR: block set mismatch {set(NEW)} vs {set(blocks)} — tell Claude")

out = head + ''.join(blocks[n] for n in NEW) + tail

# structural sanity: <section> balance must be preserved
if out.count('<section') != s.count('<section') or out.count('</section>') != s.count('</section>'):
    sys.exit("ERROR: section tag count changed — aborting, no write")
if out.count('<section') != out.count('</section>'):
    sys.exit("ERROR: unbalanced <section> tags in result — aborting")

open(p, 'w').write(out)
print("  ~ sections reordered -> Services, Gallery, Process, Configurator+Specs, Reviews, FAQ")
print("  = Hero pinned first, Quote pinned last")
PY

echo ""
echo "Done. Review:  git --no-pager diff apps/web/app/page.tsx"
