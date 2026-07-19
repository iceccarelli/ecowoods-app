#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# apply-remove-marquee-add-pricing.sh
#
#  1. REMOVE the certification marquee (scrolling self-declared badge bar under
#     the hero). It repeats claims the Services pillars already prove properly,
#     and self-declared badges scrolling past = motion without information.
#     Also removes the now-unused `certifications` array.
#
#  2. ADD a transparent tiered-pricing section (#pricing) right before #quote —
#     the highest-value thing the site was missing. Ranges are PUBLISHED GTA
#     MARKET data, flagged in-file for you to replace with real Ecowoods rates.
#
# Content-matched, idempotent. Run from repo root.
# ---------------------------------------------------------------------------
set -euo pipefail
[ -f apps/web/app/page.tsx ] || { echo "ERROR: run from the repo root"; exit 1; }

cat > apps/web/app/components/PricingSection.tsx << 'PXEOF'
'use client';

/**
 * PricingSection — "How much does it cost?", answered honestly.
 *
 * The single highest-value thing the site was missing. Every GTA competitor
 * hides price behind "contact for a quote"; Ecowoods' whole promise is "fixed
 * price in writing" — so NOT showing a number was the site contradicting its own
 * headline. The research (2026): "offer and policy details visible before final
 * commitment."
 *
 * Why a TIERED RANGE, not one number: refinishing genuinely varies with
 * condition, stairs, species and finish, so a single "$X/sqft" would either
 * under-quote (awkward upsell that kills the "fixed price" trust) or over-quote
 * (scares good leads). A range is honest AND answers the question — and because
 * Ecowoods runs dustless + salaried masters, it sits in the upper band and can
 * say WHY. That is the AWS move: transparent about being premium, not cheapest.
 *
 * ⚠️ NUMBERS BELOW ARE PUBLISHED GTA MARKET RANGES (2026), NOT ECOWOODS' OWN
 *    RATES. Replace `pricePerSqFt` / `from` on each tier with your real pricing
 *    before this goes live, or the site states market data as if it were yours.
 */

const TIERS = [
  {
    id: 'recoat',
    name: 'Screen & Recoat',
    tagline: 'Refresh a floor that’s still sound',
    pricePerSqFt: '2–3', // ⚠️ market range — replace with Ecowoods rate
    blurb:
      'A light abrasion and a fresh topcoat. No full sand — right when the finish is worn but the wood underneath is healthy. Extends the floor 3–5 years.',
    best: 'Floors under ~10 years with surface wear only',
    highlight: false,
  },
  {
    id: 'standard',
    name: 'Full Sand & Finish',
    tagline: 'The complete restoration',
    pricePerSqFt: '4.50–7', // ⚠️ market range — replace with Ecowoods rate
    blurb:
      'Sanded to bare wood, stained to your choice, three coats of premium finish — all dustless. This is what most Toronto main floors need every 7–10 years.',
    best: 'Most homes · scratches, greying, or a colour change',
    highlight: true,
  },
  {
    id: 'premium',
    name: 'Premium & Hardwood Install',
    tagline: 'New floors or specialty finishes',
    pricePerSqFt: 'from 8', // ⚠️ market range — replace with Ecowoods rate
    blurb:
      'New wide-plank hardwood, oil finishes like Rubio Monocoat, custom stain matching, stairs and repairs. Priced per project after we see the space.',
    best: 'New installs, oil finishes, stairs, board repair',
    highlight: false,
  },
];

export default function PricingSection() {
  return (
    <section className="section section--card pricing" id="pricing">
      <div className="shell">
        <div className="section-head reveal">
          <span className="eyebrow">Straight Answer</span>
          <h2>
            What it costs. <span className="serif-italic">Before you call.</span>
          </h2>
          <p className="section-sub">
            Every other Toronto floor company makes you book a visit to hear a number. Here’s the
            range up front — the exact price is fixed in writing at your free in-home estimate, and
            it never moves after that.
          </p>
        </div>

        <div className="pricing-grid reveal">
          {TIERS.map((t) => (
            <div key={t.id} className={`price-card ${t.highlight ? 'is-featured' : ''}`}>
              {t.highlight && <span className="price-flag">Most common</span>}
              <div className="price-card-head">
                <h3 className="price-name">{t.name}</h3>
                <p className="price-tagline">{t.tagline}</p>
              </div>
              <div className="price-figure">
                <span className="price-currency">$</span>
                <span className="price-amount">{t.pricePerSqFt}</span>
                <span className="price-unit">/ sq ft</span>
              </div>
              <p className="price-blurb">{t.blurb}</p>
              <div className="price-best">
                <span className="price-best-label">Best for</span>
                {t.best}
              </div>
            </div>
          ))}
        </div>

        <div className="pricing-foot reveal">
          <div className="pricing-foot-fact">
            <strong>A typical 1,000 sq ft main floor</strong> runs about $4,500–$7,000, finished in
            3–5 days start to furniture back in place.
          </div>
          <p className="pricing-note">
            What moves the number: floor condition, stairs, species hardness, a light-to-dark colour
            change, and board repairs. We walk every one of these with you on-site — no surprises,
            no change orders. That’s what “fixed price in writing” means.
          </p>
          <a href="#quote" className="pricing-cta">
            Get your exact price in writing
          </a>
        </div>
      </div>
    </section>
  );
}
PXEOF
echo "  + components/PricingSection.tsx"

python3 - << 'PY'
import re, sys
p = 'apps/web/app/page.tsx'
s = open(p).read()

# --- 1. remove the marquee section ---
if 'className="marquee"' in s:
    m = re.search(r'\n\s*\{/\* Certification trust bar \*/\}\n\s*<section className="marquee".*?</section>\n', s, re.S)
    if not m:
        m = re.search(r'\n\s*<section className="marquee".*?</section>\n', s, re.S)
    if m:
        s = s.replace(m.group(0), '\n', 1); print("  ~ marquee section removed")
    else:
        print("  ! marquee markup not matched — SKIPPED")
    # drop the now-unused certifications array
    ca = re.search(r'\nconst certifications = \[.*?\];\n', s, re.S)
    if ca and 'certifications' not in s.replace(ca.group(0), ''):
        s = s.replace(ca.group(0), '\n', 1); print("  ~ unused certifications array removed")
else:
    print("  = marquee (already removed)")

# --- 2. add PricingSection import + element before #quote ---
if 'PricingSection' in s:
    print("  = pricing (already present)")
else:
    anchor_imp = "import BookingPanel from './components/BookingPanel';"
    if anchor_imp in s:
        s = s.replace(anchor_imp, "import PricingSection from './components/PricingSection';\n" + anchor_imp, 1)
    else:
        # fall back: after any component import
        s = re.sub(r"(import \w+ from '\./components/\w+';\n)",
                   r"\1import PricingSection from './components/PricingSection';\n", s, count=1)
    conv = re.search(r'\n(\s*)\{/\* 6 · CONVERSION', s)
    if not conv:
        sys.exit("ERROR: #quote insertion point (6 · CONVERSION) not found — tell Claude")
    ind = conv.group(1)
    s = s[:conv.start()] + f"\n{ind}{{/* 5c · PRICING — transparent range before the ask */}}\n{ind}<PricingSection />\n" + s[conv.start():]
    print("  ~ <PricingSection /> inserted before #quote")

open(p, 'w').write(s)

o, c = s.count('<section'), s.count('</section>')
print(f"  <section> balance {o}/{c} {'OK' if o == c else 'MISMATCH — STOP'}")
sys.exit(0 if o == c else 1)
PY

# --- 3. styles (idempotent append) ---
python3 - << 'PY'
css = 'apps/web/app/globals.css'
c = open(css).read()
if '.pricing-grid' in c:
    print("  = pricing styles (present)")
else:
    c += r'''

/* ============================================================
   PRICING — transparent tiered ranges (#pricing)
   ============================================================ */
.pricing .section-sub {
  max-width: 46ch;
  margin: 0.9rem auto 0;
  color: var(--muted);
  line-height: 1.6;
}
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.1rem;
  margin-top: 2.5rem;
}
.price-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1.6rem 1.5rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-xl);
  background: var(--surface);
}
.price-card.is-featured {
  border-color: var(--copper);
  box-shadow: 0 0 0 1px var(--copper), var(--shadow-md);
}
.price-flag {
  position: absolute;
  top: -0.7rem;
  left: 1.5rem;
  padding: 0.25rem 0.7rem;
  border-radius: var(--radius-full);
  background: var(--copper);
  color: var(--cream-50);
  font-size: var(--fs-3xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.price-name {
  margin: 0;
  font-size: var(--fs-lg);
  color: var(--ink);
}
.price-tagline {
  margin: 0.2rem 0 0;
  font-size: var(--fs-sm);
  color: var(--muted);
}
.price-figure {
  display: flex;
  align-items: baseline;
  gap: 0.15rem;
  padding-bottom: 0.9rem;
  border-bottom: 1px solid var(--line);
}
.price-currency {
  font-size: var(--fs-md);
  color: var(--copper-text);
  font-weight: 600;
}
.price-amount {
  font-family: var(--font-display);
  font-size: clamp(2rem, 5vw, 2.6rem);
  font-weight: 500;
  color: var(--ink);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.price-unit {
  font-size: var(--fs-sm);
  color: var(--muted);
}
.price-blurb {
  margin: 0;
  font-size: var(--fs-sm);
  line-height: 1.6;
  color: var(--muted);
}
.price-best {
  margin-top: auto;
  font-size: var(--fs-xs);
  color: var(--ink);
  line-height: 1.5;
}
.price-best-label {
  display: block;
  font-size: var(--fs-3xs);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--muted-soft);
  margin-bottom: 0.2rem;
}
.pricing-foot {
  margin-top: 2rem;
  text-align: center;
}
.pricing-foot-fact {
  font-size: var(--fs-md);
  color: var(--ink);
  line-height: 1.6;
}
.pricing-note {
  max-width: 60ch;
  margin: 0.9rem auto 1.6rem;
  font-size: var(--fs-sm);
  color: var(--muted);
  line-height: 1.65;
}
.pricing-cta {
  display: inline-block;
  padding: 0.95rem 1.8rem;
  border-radius: var(--radius-full);
  background: var(--copper);
  color: var(--cream-50);
  font-weight: 600;
  text-decoration: none;
  transition: transform 0.15s ease, background 0.15s ease;
}
.pricing-cta:hover { background: var(--copper-deep); }
.pricing-cta:active { transform: translateY(1px); }

@media (max-width: 860px) {
  .pricing-grid { grid-template-columns: 1fr; gap: 0.9rem; }
  .price-card.is-featured { order: -1; }
}
'''
    open(css, 'w').write(c)
    print("  ~ pricing styles appended")

c = open(css).read()
o, cl = c.count('{'), c.count('}')
print(f"  braces {o}/{cl} {'OK' if o == cl else 'MISMATCH — STOP'}")
import sys; sys.exit(0 if o == cl else 1)
PY

echo ""
echo "Done. Review:  git --no-pager diff"
