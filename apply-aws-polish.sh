#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# apply-aws-polish.sh
#
# Three evidenced changes, content-matched (immune to line drift):
#
#  1. HERO CONTRAST — the scrim's weakest stop (0.25) sat exactly where the
#     headline and body text are. Re-aimed so it is strongest under the text.
#  2. QUOTE/FOOTER DEDUPE — #quote published phone + email + showroom + hours;
#     the footer republished all four ~300px below. #quote now keeps ONE fast
#     path (phone + when to call); the footer owns the reference block.
#  3. FOOTER AS A ROUNDED CARD — the AWS pattern from the reference screenshot:
#     a dark card inset from the page edge with rounded top corners, rather
#     than a full-bleed band.
#
# Usage from repo root:  bash apply-aws-polish.sh
# Idempotent: re-running reports "already applied".
# ---------------------------------------------------------------------------
set -euo pipefail
[ -f apps/web/app/page.tsx ] || { echo "ERROR: run from the repo root"; exit 1; }

python3 - << 'PY'
import re, sys

page = 'apps/web/app/page.tsx'
css  = 'apps/web/app/globals.css'

# =========================================================================
# 1. HERO SCRIM
# =========================================================================
c = open(css).read()
old_scrim = """  background-image:
    linear-gradient(115deg, rgba(26, 15, 8, 0.55) 0%, rgba(26, 15, 8, 0.25) 45%, rgba(26, 15, 8, 0.6) 100%),"""
new_scrim = """  /* The old ramp was 115deg 0.55 -> 0.25 @45% -> 0.6. Its WEAKEST stop (0.25)
     landed exactly where the headline and body sit, so the copy dissolved into
     any bright window in the photo. Text here is left-aligned, so the scrim is
     now strongest at the left and releases toward the right, where the photo
     should actually be visible. Second layer lifts the bottom so the trust bar
     stays legible over pale floorboards. */
  background-image:
    linear-gradient(180deg, rgba(26, 15, 8, 0.15) 0%, transparent 30%, rgba(26, 15, 8, 0.45) 100%),
    linear-gradient(90deg, rgba(26, 15, 8, 0.84) 0%, rgba(26, 15, 8, 0.66) 38%, rgba(26, 15, 8, 0.32) 72%, rgba(26, 15, 8, 0.5) 100%),"""
if old_scrim in c:
    c = c.replace(old_scrim, new_scrim, 1); print("  ~ hero scrim re-aimed")
elif 'scrim is\n     now strongest at the left' in c:
    print("  = hero scrim (already applied)")
else:
    print("  ! hero scrim: anchor not found — SKIPPED (tell Claude)")

# =========================================================================
# 3. FOOTER AS A ROUNDED CARD  (AWS pattern)
# =========================================================================
if '.site-footer {' in c and 'aws-style card' not in c:
    c += """

/* ============================================================
   FOOTER AS A CARD — the AWS pattern
   AWS does not run its footer as a full-bleed band; it is a dark card inset
   from the page edge with rounded top corners, so the page visibly ENDS and
   the footer reads as a distinct object rather than more page. This is the
   single cheapest "section distinction" trick they use, and it costs two
   properties.
   ============================================================ */
.site-footer {
  /* aws-style card */
  margin: 0 auto;
  max-width: calc(var(--shell-max) + (var(--shell-pad) * 2) + 4rem);
  border-radius: 28px 28px 0 0;
  overflow: hidden;
}
@media (max-width: 767px) {
  .site-footer {
    margin: 0 0.75rem;
    border-radius: 22px 22px 0 0;
  }
}

/* ---- compact contact line in #quote (replaces the duplicated stack) ---- */
.quote-contact {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-bottom: 1.5rem;
  padding: 0.95rem 1.1rem;
  border: 1px solid rgba(200, 126, 79, 0.32);
  border-radius: 14px;
  background: rgba(200, 126, 79, 0.09);
  text-decoration: none;
}
.quote-contact-icon {
  flex: 0 0 auto;
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  color: var(--copper-bright);
  background: rgba(245, 239, 230, 0.07);
  border: 1px solid rgba(245, 239, 230, 0.14);
}
.quote-contact-text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.quote-contact-label {
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(245, 239, 230, 0.55);
}
.quote-contact-num {
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--cream-50);
}
.quote-contact-when {
  font-size: 0.82rem;
  color: rgba(245, 239, 230, 0.6);
}
"""
    print("  ~ footer card + quote-contact styles")
else:
    print("  = footer card (already applied)")

open(css, 'w').write(c)

# =========================================================================
# 2. QUOTE / FOOTER DEDUPE
# =========================================================================
s = open(page).read()
if 'quote-contact' in s:
    print("  = quote dedupe (already applied)")
else:
    m = re.search(r'\n\s*<div className="contact-points">.*?\n(\s*)</div>\n\n(\s*)<button', s, re.S)
    if not m:
        m = re.search(r'\n\s*<div className="contact-points">.*?\n\s*</div>\n', s, re.S)
    if not m:
        print("  ! quote dedupe: contact-points block not found — SKIPPED (tell Claude)")
    else:
        block = m.group(0)
        replacement = """
              {/*
                The footer already publishes email, showroom address and full
                hours ~300px below this. Repeating them here made the reader
                process the same four facts twice and buried the actual action.
                This section keeps ONE fast path — phone, plus when to use it —
                and lets the footer own the reference block.
              */}
              <a href="tel:+14162491276" className="quote-contact">
                <span className="quote-contact-icon">{Icon.phone}</span>
                <span className="quote-contact-text">
                  <span className="quote-contact-label">Prefer to talk?</span>
                  <span className="quote-contact-num">(416) 249-1276</span>
                  <span className="quote-contact-when">Mon–Sat 8 AM – 7 PM · Sun 10 AM – 4 PM</span>
                </span>
              </a>
"""
        tail = block[block.rstrip().rfind('\n'):] if block.rstrip().endswith('<button') else ''
        s = s.replace(block, replacement + (m.group(0)[m.group(0).rfind('\n'):] if '<button' in block else '\n'), 1)
        open(page, 'w').write(s)
        print("  ~ quote dedupe: 4 contact points -> 1 phone path")

# sanity
c = open(css).read()
o, cl = c.count('{'), c.count('}')
print(f"  braces {o}/{cl} {'OK' if o == cl else 'MISMATCH — STOP'}")
sys.exit(0 if o == cl else 1)
PY

echo ""
echo "Done. Review with:  git --no-pager diff"
