#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# apply-font-unify.sh
#
# Snaps inline `fontSize` REM values onto the --fs-* token scale. An earlier
# pass tokenised the CSS, but inline styles across components still used
# off-scale rems (0.7, 0.78, 0.82, 0.85, 0.9, 0.92) that read as "almost the
# same size but not quite" drift.
#
# Nearest-token map (all shifts < 0.75px — imperceptible, but on-scale):
#   0.7  -> --fs-3xs   0.78 -> --fs-2xs   0.82 -> --fs-xs
#   0.85 -> --fs-sm    0.9  -> --fs-sm    0.92 -> --fs-sm
#
# DELIBERATELY LEFT ALONE:
#   - ChatWidget numeric px (14.5, 13.5, 11.5, 10.5, 14, 13, 11, 18, 17):
#     computed JS style objects; injecting var() strings risks layout math.
#     Self-contained widget, visually isolated — no cross-page drift.
#   - '3rem' in verify-email: those size EMOJI glyphs (⚠️✅❌⏰), not text.
#
# Content-matched, idempotent. Run from repo root.
# ---------------------------------------------------------------------------
set -euo pipefail
[ -f apps/web/app/page.tsx ] || { echo "ERROR: run from the repo root"; exit 1; }

python3 - << 'PY'
import sys, glob, re

REPL = {
    "fontSize: '0.7rem'":  "fontSize: 'var(--fs-3xs)'",
    "fontSize: '0.78rem'": "fontSize: 'var(--fs-2xs)'",
    "fontSize: '0.82rem'": "fontSize: 'var(--fs-xs)'",
    "fontSize: '0.85rem'": "fontSize: 'var(--fs-sm)'",
    "fontSize: '0.9rem'":  "fontSize: 'var(--fs-sm)'",
    "fontSize: '0.92rem'": "fontSize: 'var(--fs-sm)'",
}

# every .tsx under app/, so nothing is missed by a hardcoded file list
files = glob.glob('apps/web/app/**/*.tsx', recursive=True)
total, touched = 0, []
for f in files:
    s = open(f).read()
    n = 0
    for old, new in REPL.items():
        c = s.count(old)
        if c:
            s = s.replace(old, new); n += c
    if n:
        open(f, 'w').write(s)
        touched.append((f.split('apps/web/app/')[-1], n))
        total += n

for name, n in sorted(touched):
    print(f"  ~ {name}: {n} inline size(s) -> tokens")
if total == 0:
    print("  = inline rem sizes (already tokenised)")

# report what remains, categorised
px = rem = 0
for f in files:
    s = open(f).read()
    px  += len(re.findall(r"fontSize: [0-9.]+\b", s))          # numeric px (ChatWidget)
    rem += len(re.findall(r"fontSize: '[0-9.]+rem'", s))       # any leftover rem
print(f"  · numeric-px inline sizes left (ChatWidget, by design): {px}")
print(f"  · rem inline sizes left (should be '3rem' emoji only):  {rem}")
sys.exit(0)
PY

echo ""
echo "Done. Review:  git --no-pager diff"
