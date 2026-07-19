#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# apply-copy-polish.sh
#
# Sharpens copy in the AWS/Siemens/Tesla register: specificity and verbs over
# adjectives. These are pure language changes — no NEW claims, nothing that
# needs legal/factual verification (the hero headline and warranty wording are
# handled separately, as they require your sign-off).
#
# Changes:
#   - Section eyebrows: generic labels -> confident, specific
#   - Services sub: add "accountable" (the emotional core)
#   - Standard-deck CTA: "standard" (abstract) -> "crew" (people, accountable)
#
# Content-matched, idempotent. Run from repo root.
# ---------------------------------------------------------------------------
set -euo pipefail
[ -f apps/web/app/page.tsx ] || { echo "ERROR: run from the repo root"; exit 1; }

python3 - << 'PY'
import sys
p = 'apps/web/app/page.tsx'
s = open(p).read()
changed = []

edits = [
    # (old, new, label)
    ('<span className="eyebrow">Proof</span>',
     '<span className="eyebrow">The Verdict</span>',
     'Reviews eyebrow: Proof -> The Verdict'),
    ('<span className="eyebrow">Results</span>',
     '<span className="eyebrow">The Work</span>',
     'Gallery eyebrow: Results -> The Work'),
    ('<span className="eyebrow">How It Works</span>',
     '<span className="eyebrow">The Process</span>',
     'Process eyebrow: How It Works -> The Process'),
    ('<span className="eyebrow">Before You Book</span>',
     '<span className="eyebrow">Straight Answers</span>',
     'FAQ eyebrow: Before You Book -> Straight Answers'),
    ('every service\n              delivered by the same family-owned shop since 1998.',
     'every service,\n              one shop, one accountable name — since 1998.',
     'Services sub: + "accountable"'),
]

for old, new, label in edits:
    if new.split('>')[-1][:12] in s and old not in s:
        # already applied (rough check)
        continue
    if old in s:
        s = s.replace(old, new, 1)
        changed.append(label)

# StandardDeck CTA lives in page.tsx data OR the component — try both files
open(p, 'w').write(s)
for c in changed:
    print(f"  ~ {c}")
if not changed:
    print("  = page.tsx copy (already applied or anchors not found)")

# the standard-deck CTA
sd = 'apps/web/app/components/StandardDeck.tsx'
try:
    t = open(sd).read()
    if 'Get this standard in your home' in t:
        t = t.replace('Get this standard in your home', 'Put this crew in your home')
        open(sd, 'w').write(t)
        print("  ~ StandardDeck CTA: 'standard' -> 'crew'")
    elif 'Put this crew in your home' in t:
        print("  = StandardDeck CTA (already applied)")
except FileNotFoundError:
    pass

# CTA may instead be passed from page.tsx
if 'Get this standard in your home' in s:
    s = s.replace('Get this standard in your home', 'Put this crew in your home')
    open(p, 'w').write(s)
    print("  ~ StandardDeck CTA (page.tsx): 'standard' -> 'crew'")
PY

echo ""
echo "Done. Review:  git --no-pager diff"
