#!/usr/bin/env python3
"""
fix-batch2-placement.py — repair what place-batch2.py got wrong.

Three defects, all in the injection, none in the images:

  1. papers/[slug]/page.tsx — the pairs block was spliced INSIDE the existing
     `{SECTION_IMAGE[...] && ( … )}` conditional, and a `{false && (` was left
     behind to re-balance it. `{false && ()}` is an empty expression: TS1109.

  2. services/[slug]/page.tsx — the import was inserted after the first line
     matching /^import /, which in that file is the OPENING line of a
     multi-line `import {` block. The new import landed between the braces.

  3. services/[slug]/page.tsx — the render referenced `sp.slug`; the variable
     in that scope is `slug`.

Idempotent: a file already correct is left alone.
"""
import os, re, subprocess, sys

ROOT = subprocess.check_output(["git","rev-parse","--show-toplevel"]).decode().strip()
APP  = os.path.join(ROOT, "apps/web/app")
fixed = []

# ── 1. papers ───────────────────────────────────────────────────────────────
p = os.path.join(APP, "papers/[slug]/page.tsx")
s = open(p, encoding="utf8").read()
if "{false && (" in s:
    s = re.sub(r"\n\s*\{false && \(\n\s*\)\}", "", s)
    open(p, "w", encoding="utf8").write(s)
    fixed.append("papers/[slug]/page.tsx — removed the empty {false && ()} expression")

# ── 2 + 3. services ─────────────────────────────────────────────────────────
p = os.path.join(APP, "services/[slug]/page.tsx")
s = open(p, encoding="utf8").read()
before = s

# the stray import, wherever it landed
s = s.replace("import { IllustrationPair } from '../../components/Illustration';\n", "")
# fold it into the import that is already there
# Test for the IMPORT, not the bare word — the explanatory comment above
# SERVICE_PAIRS mentions IllustrationPair, which made the first version of this
# check think the import was already there.
if not re.search(r"import \{[^}]*IllustrationPair[^}]*\} from", s):
    s = s.replace(
        "import { Illustration } from '../../components/Illustration';",
        "import { Illustration, IllustrationPair } from '../../components/Illustration';",
        1,
    )
# the wrong variable
s = s.replace("SERVICE_PAIRS[sp.slug]", "SERVICE_PAIRS[slug]")

if s != before:
    open(p, "w", encoding="utf8").write(s)
    fixed.append("services/[slug]/page.tsx — import folded into the existing one, sp.slug → slug")

# ── every other placed file: make sure the import is not inside a brace block ─
for rel in ["hardwood-stairs-toronto/page.tsx", "hardwood-floor-problems-toronto/page.tsx",
            "hardwood-floor-refinishing-toronto/page.tsx", "service-areas/page.tsx",
            "framework/page.tsx", "guides/[slug]/page.tsx"]:
    p = os.path.join(APP, rel)
    if not os.path.exists(p):
        continue
    lines = open(p, encoding="utf8").read().split("\n")
    idx = next((i for i, l in enumerate(lines) if "IllustrationPair }" in l and l.startswith("import")), None)
    if idx is None:
        continue
    prev = lines[idx - 1].strip() if idx else ""
    if prev.endswith("{") or (prev.startswith("import") and not prev.endswith(";")):
        line = lines.pop(idx)
        end = next((i for i, l in enumerate(lines) if re.match(r"^\} from '.*';$", l)), None)
        anchor = end if end is not None else max(
            (i for i, l in enumerate(lines) if re.match(r"^import .*;$", l)), default=0)
        lines.insert(anchor + 1, line)
        open(p, "w", encoding="utf8").write("\n".join(lines))
        fixed.append(f"{rel} — import moved out of a multi-line import block")

print("fixed:" if fixed else "nothing to fix — files already correct")
for f in fixed:
    print("  " + f)
