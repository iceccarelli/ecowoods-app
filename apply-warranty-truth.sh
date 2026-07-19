#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# apply-warranty-truth.sh
#
# Removes the FALSE "lifetime workmanship warranty" / "Guaranteed for Life"
# claims — Ecowoods offers manufacturer material warranties only — and replaces
# them with the TRUE, specific claim (25–35 yr finish, up to 50 yr structural,
# in writing) across all seven places it appears.
#
# Also swaps the hero headline to "Hardwood, Done Once. Done Right."
#
# Content-matched, idempotent. Run from repo root.
# ---------------------------------------------------------------------------
set -euo pipefail
[ -f apps/web/app/page.tsx ] || { echo "ERROR: run from the repo root"; exit 1; }

python3 - << 'PY'
import sys
p = 'apps/web/app/page.tsx'
s = open(p).read()
n = 0

edits = [
  # hero headline
  ('Mastercrafted Hardwood Flooring.<br />\n            <em>Guaranteed for Life.</em>',
   'Hardwood, Done Once.<br />\n            <em>Done Right.</em>'),
  # pillar
  ("title: 'Lifetime Warranty',\n    proof: 'Every job, every home — we stand behind our work for as long as you own it.',",
   "title: 'Manufacturer-Backed',\n    proof: 'Premium finishes carry 25–35 year manufacturer warranties, structural to 50 — passed straight through to you, in writing.',"),
  # standard
  ("title: 'Lifetime Protection',\n    line: 'A lifetime workmanship warranty, in writing, for as long as you own the home.',",
   "title: 'Warranties in Writing',\n    line: 'Manufacturer finish and structural warranties — 25 to 50 years — documented in your contract, not just promised.',"),
  # gallery caption
  ("sub: '1,800 sq ft Red Oak — Lifetime Warranty Delivered',",
   "sub: '1,800 sq ft Red Oak — Fixed Price, Zero Dust',"),
  # FAQ q + a
  ("q: 'What exactly does the lifetime warranty cover?',",
   "q: 'What warranty comes with the work?',"),
  ("a: 'Every Ecowoods installation and refinish carries a lifetime workmanship warranty for as long as you own the home — transferable once at sale. Manufacturer material warranties (typically 25–35 years on finish, 50 years structural) pass through on top. Everything is in writing in your contract.',",
   "a: 'Your finishes and materials carry their manufacturer warranties — typically 25–35 years on finish, up to 50 years structural — and we pass every one through to you in writing, itemized in your contract. If anything in our workmanship isn\\'t right, we come back and make it right. No runaround.',"),
]

for old, new in edits:
    if old in s:
        s = s.replace(old, new, 1); n += 1

open(p, 'w').write(s)
print(f"  ~ page.tsx: {n}/6 warranty claims corrected")

# any leftover false claim in page.tsx?
import re
leftover = re.findall(r'(lifetime workmanship|lifetime warranty|Guaranteed for Life)', s, re.I)
# exclude code comments about the stat row
leftover = [x for x in leftover if True]
if any('workmanship' in x.lower() or 'guaranteed for life' in x.lower() or 'lifetime warranty' in x.lower() for x in leftover):
    print(f"  ! WARNING: possible leftover claim in page.tsx: {set(leftover)}")

# footer
f = 'apps/web/app/components/SiteFooter.tsx'
t = open(f).read()
old_f = 'Eco-friendly finishes, lifetime workmanship warranty, dust-free refinishing.'
new_f = 'Eco-friendly finishes, manufacturer-backed warranties, dust-free refinishing.'
if old_f in t:
    t = t.replace(old_f, new_f, 1); open(f, 'w').write(t)
    print("  ~ SiteFooter: warranty line corrected")
elif new_f in t:
    print("  = SiteFooter (already corrected)")

sys.exit(0)
PY

echo ""
echo "=== FINAL SWEEP: any false lifetime-warranty claim left in user-facing copy? ==="
if grep -rniE "lifetime workmanship|lifetime warranty|guaranteed for life" apps/web/app/page.tsx apps/web/app/components/SiteFooter.tsx | grep -viE "^\s*\*|//|/\*"; then
  echo "  !! CLAIMS REMAIN — review above"
else
  echo "  ✓ clean — no false lifetime-warranty claims in copy"
fi
echo ""
echo "Done. Review:  git --no-pager diff"
