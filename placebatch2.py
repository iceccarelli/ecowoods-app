#!/usr/bin/env python3
"""
place-batch2.py — draw every batch-2 pair on the page that explains it.

verify-images.mjs counts a slot as DRAWN only when a .tsx importing
components/Illustration names its id. An href says where an image points; it
does not say anything renders it. This is the step that makes that true.

Idempotent: a file already carrying IllustrationPair is left alone.
"""
import os, re, subprocess, sys

ROOT = subprocess.check_output(["git","rev-parse","--show-toplevel"]).decode().strip()
APP  = os.path.join(ROOT, "apps/web/app")

# file -> [(anchor line contains, base id), ...]  — pair rendered right after the anchor line
STATIC = {
  "hardwood-stairs-toronto/page.tsx": [
    ("Stairs are not priced by the square foot", "stairs-labour-vs-area"),
    ("Four different jobs, all called",           "stairs-four-jobs"),
    ("Why stairs are the part that gives a job away", "stairs-anatomy"),
    ("Why stairs are the part that gives a job away", "stairs-tread-vs-cap"),
  ],
  "hardwood-floor-problems-toronto/page.tsx": [
    ("Find your symptom", "symptom-cause-tree"),
  ],
  "hardwood-floor-refinishing-toronto/page.tsx": [
    ("Which of these your floor needs", "depth-three-refinishing-services"),
    ("Questions people actually ask",   "wear-layer-refinish-budget"),
  ],
  "service-areas/page.tsx": [
    ("What the crews do, wherever the job is", "map-service-areas-gta"),
  ],
  "framework/page.tsx": [
    ("Three ways this is meant to be used", "concept-document-set"),
  ],
}

# dynamic collections: page file -> (map name, key -> [base ids], render anchor)
PAPER_PAIRS = {
  "hardwood-refinishing-machines-and-sequence#the-four-machines": ["machine-footprints-to-scale"],
  "hardwood-refinishing-machines-and-sequence#belt-sander":       ["machine-belt-drum-section"],
  "hardwood-refinishing-machines-and-sequence#edger":             ["machine-edger-reach"],
  "hardwood-refinishing-machines-and-sequence#planetary":         ["machine-planetary-rotation"],
}
# Both ids are written out in full. `${base}-b` would be a template literal, and
# the guard reads quoted literals — a template is invisible to it, which is
# exactly how the -b half of every dynamic pair went unnoticed on the first run.
GUIDE_PAIRS = {
  "reference-condominium-concrete-slab": ["assembly-condo-slab-stack", "gap-midfield-obstructions"],
  "reference-radiant-heat-main-floor":   ["radiant-failure-delay"],
  "hardwood-flooring-cost-toronto":      ["price-bands-to-scale", "change-order-drift"],
  "nail-down-glue-down-or-floating":     ["acoustic-three-methods"],
  "herringbone-chevron-parquet-toronto": ["pattern-layout-three"],
}
SERVICE_PAIRS = {
  "hardwood-installation": ["protocol-timeline-install", "concept-acclimation-72h"],
}

NOTE = """/* One fact, two drawings of it. `<id>` and `<id>-b` were briefed once and
   drawn twice; IllustrationPair alternates them by cross-fade. Not kenburns —
   see the note above IllustrationMotion in components/Illustration.tsx: a scale
   inside a fixed frame crops, and on an explanatory figure the crop removes the
   thing the figure exists to show. */"""

def add_import(src, depth):
    if "IllustrationPair" in src and "import" in src.split("\n")[0:40].__str__():
        if re.search(r"import \{ IllustrationPair \}", src):
            return src
    rel = "../" * depth + "components/Illustration"
    line = f"import {{ IllustrationPair }} from '{rel}';\n"
    m = list(re.finditer(r"^import .*\n", src, re.M))
    return src[:m[-1].end()] + line + src[m[-1].end():] if m else line + src

# The guard's file filter is /from '.*components\/Illustration'/ — it needs a
# QUOTE immediately after "Illustration", so '../components/IllustrationPair'
# does not match it. Re-exporting the pair from Illustration.tsx means pages
# import one path, the guard sees it, and there is one entry point for figures
# instead of two.
IL = os.path.join(APP, "components/Illustration.tsx")
il = open(IL, encoding="utf8").read()
if "export { IllustrationPair }" not in il:
    il += ("\n/* The paired variant lives in its own file because it is a client component\n"
           "   and this one is not. It is re-exported here so a page importing figures\n"
           "   imports one module — and so scripts/verify-images.mjs, which recognises a\n"
           "   drawing page by this exact import path, sees pages that use only pairs. */\n"
           "export { IllustrationPair } from './IllustrationPair';\n")
    open(IL, "w", encoding="utf8").write(il)
    print("  re-exported IllustrationPair from components/Illustration.tsx")

changed = []

for rel, items in STATIC.items():
    path = os.path.join(APP, rel)
    if not os.path.exists(path):
        print(f"  skip (missing): {rel}"); continue
    src = open(path, encoding="utf8").read()
    if "IllustrationPair" in src:
        print(f"  skip (done):    {rel}"); continue
    lines = src.split("\n")
    for anchor, base in reversed(items):
        idx = next((i for i, l in enumerate(lines) if anchor in l), None)
        if idx is None:
            sys.exit(f"anchor not found in {rel}: {anchor}")
        indent = " " * (len(lines[idx]) - len(lines[idx].lstrip()))
        lines.insert(idx + 1, f'{indent}<IllustrationPair a="{base}" b="{base}-b" />')
    src = "\n".join(lines)
    src = add_import(src, rel.count("/"))
    open(path, "w", encoding="utf8").write(src)
    changed.append(rel)

def inject_map(rel, name, data, anchor_re, render):
    path = os.path.join(APP, rel)
    if not os.path.exists(path):
        print(f"  skip (missing): {rel}"); return
    src = open(path, encoding="utf8").read()
    if name in src:
        print(f"  skip (done):    {rel}"); return
    body = "\n".join(
        "  '%s': [%s]," % (k, ", ".join("['%s', '%s-b']" % (v, v) for v in vs))
        for k, vs in data.items()
    )
    decl = f"\n{NOTE}\nconst {name}: Record<string, [string, string][]> = {{\n{body}\n}};\n"
    m = re.search(anchor_re, src)
    if not m:
        sys.exit(f"could not find the render anchor in {rel}")
    src = src[:m.start()] + render + src[m.end():]
    # declaration goes after the last top-level import
    im = list(re.finditer(r"^import .*\n", src, re.M))
    src = src[:im[-1].end()] + decl + src[im[-1].end():]
    src = add_import(src, rel.count("/"))
    open(path, "w", encoding="utf8").write(src)
    changed.append(rel)

inject_map(
  "papers/[slug]/page.tsx", "SECTION_PAIRS", PAPER_PAIRS,
  r"<Illustration id=\{SECTION_IMAGE\[`\$\{paper\.slug\}#\$\{section\.id\}`\]\} />",
  "<Illustration id={SECTION_IMAGE[`${paper.slug}#${section.id}`]} />\n"
  "              )}\n"
  "              {(SECTION_PAIRS[`${paper.slug}#${section.id}`] ?? []).map((p) => (\n"
  "                <IllustrationPair key={p[0]} a={p[0]} b={p[1]} />\n"
  "              ))}\n"
  "              {false && (",
)
inject_map(
  "guides/[slug]/page.tsx", "GUIDE_PAIRS", GUIDE_PAIRS,
  r"<Illustration id=\{GUIDE_IMAGE\[guide\.slug\] \?\? ''\} priority />",
  "<Illustration id={GUIDE_IMAGE[guide.slug] ?? ''} priority />\n"
  "          {(GUIDE_PAIRS[guide.slug] ?? []).map((p) => (\n"
  "            <IllustrationPair key={p[0]} a={p[0]} b={p[1]} />\n"
  "          ))}",
)

sp = os.path.join(APP, "services/[slug]/page.tsx")
if os.path.exists(sp):
    s = open(sp, encoding="utf8").read()
    m = re.search(r"<Illustration id=\{[^}]+\}[^/]*/>", s)
    if m and "SERVICE_PAIRS" not in s:
        inject_map(
          "services/[slug]/page.tsx", "SERVICE_PAIRS", SERVICE_PAIRS,
          re.escape(m.group(0)),
          m.group(0) + "\n"
          "          {(SERVICE_PAIRS[sp.slug] ?? []).map((p) => (\n"
          "            <IllustrationPair key={p[0]} a={p[0]} b={p[1]} />\n"
          "          ))}",
        )

print(f"\nplaced pairs in {len(changed)} file(s):")
for c in changed: print("  " + c)
