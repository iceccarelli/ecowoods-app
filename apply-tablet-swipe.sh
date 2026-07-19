#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# apply-tablet-swipe.sh
#
# The swipe decks were gated to phones only: useIsMobile defaulted to
# (max-width: 767px), so on an iPad/tablet every deck — including pricing —
# fell back to the desktop grid and stacked vertically (the screenshot).
#
# This raises the shared breakpoint to 1023px, so ALL decks (Services, Reviews,
# Process, Gallery, Configurator, Booking, Pricing) swipe on tablets too. 1023
# (not 1024) so a 1024px iPad-landscape / small-desktop still gets the grid.
#
# Deck (.pfd) CSS is not breakpoint-gated, so it applies whenever the deck
# renders — raising the JS breakpoint is sufficient and safe. The three existing
# 767px media queries are footer/card/summary styling, unrelated to decks, and
# are left untouched.
#
# Idempotent. Run from repo root.
# ---------------------------------------------------------------------------
set -euo pipefail
f=apps/web/app/components/SwipeDeck.tsx
[ -f "$f" ] || { echo "ERROR: SwipeDeck.tsx not found"; exit 1; }

python3 - "$f" << 'PY'
import sys
f = sys.argv[1]
s = open(f).read()

old = "export function useIsMobile(query = '(max-width: 767px)') {"
new = "export function useIsMobile(query = '(max-width: 1023px)') {"

if new in s:
    print("  = breakpoint already 1023px")
elif old in s:
    s = s.replace(old, new, 1)
    open(f, 'w').write(s)
    print("  ~ useIsMobile breakpoint 767px -> 1023px (phones + tablets)")
else:
    # some other value is in place — report it rather than guessing
    import re
    m = re.search(r"useIsMobile\(query = '\(max-width: (\d+)px\)'\)", s)
    if m:
        print(f"  ! breakpoint is {m.group(1)}px, not the expected 767 — leaving as-is; tell Claude")
        sys.exit(1)
    sys.exit("ERROR: useIsMobile signature not found")
PY

echo ""
echo "Done. Review:  git --no-pager diff apps/web/app/components/SwipeDeck.tsx"
