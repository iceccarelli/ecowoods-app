#!/usr/bin/env python3
"""
add-batch2-slots.py — write the 44 batch-2 slots into apps/web/lib/images.ts.

Idempotent: an id already present is skipped, so re-running is safe.
Dimensions are MEASURED off the files on disk, never typed.
"""
import os, re, subprocess, sys

ROOT = subprocess.check_output(["git","rev-parse","--show-toplevel"]).decode().strip()
MAN  = os.path.join(ROOT, "apps/web/lib/images.ts")
ILL  = os.path.join(ROOT, "apps/web/public/illustrations")

# id, helper (d = flat vector diagram / p = photorealistic render), href, alt, caption, prompt
S = [
("stairs-anatomy","d","/hardwood-stairs-toronto",
 "A single stair tread drawn in section, with the nosing, the return, the riser and the skirt board each picked out as a separate part of the assembly.",
 "The parts of a stair a quote should name. The nosing is the leading edge, the return is the finished side where the tread meets open air, and both are where a rushed job shows first.",
 "A cutaway side-and-three-quarter view of one hardwood stair tread and the riser beneath it, drawn orthographically, the overhanging front edge and the finished side edge picked out in the copper accent."),
("stairs-four-jobs","d","/hardwood-stairs-toronto",
 "Four staircases drawn side by side showing four different scopes of stair work — refinishing the existing treads, removing carpet and finishing what is underneath, fitting new solid treads, and matching stairs to a newly installed floor.",
 "Four different jobs, all called “stairs”. They share a word and almost nothing else — which is why a stair line on a quote that does not say which one it is, is not a price.",
 "Four small hardwood staircases of identical geometry side by side in flat side elevation, each showing a different scope of work, the differing element in copper accent."),
("stairs-labour-vs-area","d","/hardwood-stairs-toronto",
 "A flight of thirteen treads shown beside a large rectangle of open floor, with the small surface area of the stairs set against a labour bar three times the height of the floor's.",
 "A flight of thirteen treads is roughly forty square feet of surface and roughly three times the labour of four hundred square feet of open floor. Stairs are priced per tread because area is the wrong unit for them.",
 "A composition in two halves: a compact block of thirteen stair treads in plan beside a large open rectangle of floorboards, with effort bars beneath inverted against the areas above, effort bars in copper accent."),
("stairs-tread-vs-cap","d","/hardwood-stairs-toronto",
 "Two stair treads drawn in section side by side — one a full-thickness solid tread replacing the original, the other a thin retrofit cap fitted over the existing structure.",
 "Full-depth tread or retrofit cap. Both are “new stairs” on a quote and they are different pieces of work with different consequences for the nosing height and the finished rise.",
 "Two stair tread sections side by side in flat side elevation: one thick solid tread seated on the carriage, one thin cap over a retained original tread, added material in copper accent."),
("machine-belt-drum-section","d","/papers/hardwood-refinishing-machines-and-sequence",
 "Cross-section through a belt floor sander showing the continuous abrasive belt running over a cylindrical drum roughly two hundred millimetres wide, with the cut it takes into the board surface below.",
 "The belt sander levels the open field. A continuous abrasive belt runs over a cylindrical drum about 200 mm wide, and the operator walks behind it at a steady pace — pace is what decides whether it levels or gouges.",
 "A cutaway side section through the working head of a belt floor sander, drum and tensioned abrasive belt in section over floorboards, the removed layer in copper accent."),
("machine-edger-reach","d","/papers/hardwood-refinishing-machines-and-sequence",
 "Plan view of a room showing the wide central field the belt sander reaches, and the narrow band around the walls, into closets and around obstructions that only the smaller edger can reach.",
 "The edger exists because the big machine cannot reach a wall. Its disc is roughly 150–178 mm across, in a body compact enough for baseboards, closets and stair treads — and the boundary between the two machines is where the halo forms.",
 "Overhead plan of a room with a wide central hatched field and a narrow continuous perimeter band wrapping into a closet alcove and door reveal, the perimeter band in copper accent."),
("machine-planetary-rotation","d","/papers/hardwood-refinishing-machines-and-sequence",
 "A planetary sander seen from above, with three counter-rotating discs mounted on a head that itself rotates, and the overlapping non-repeating scratch pattern this produces on the boards below.",
 "The planetary sander blends the field and the edge together. Three or more discs counter-rotate on a head that is itself rotating, so no scratch repeats in the same place — which is what removes the boundary the first two machines leave.",
 "Top-down orthographic view of a sander head carrying three counter-rotating discs, with the resulting non-repeating looping scratch trace on boards beside it in copper accent."),
("machine-footprints-to-scale","d","/papers/hardwood-refinishing-machines-and-sequence",
 "The four floor machines drawn to a single common scale in plan — belt sander, edger, planetary sander and buffer — so the difference between an eight-inch drum, a six-to-seven-inch disc and a sixteen-to-twenty-inch drive plate is visible as size.",
 "Four machines, four footprints, one scale. The sequence is not a preference: each machine reaches what the one before it could not, and the reason is the size and geometry of its working face.",
 "Four machine plan outlines in a row at one consistent scale, each working face — drum, disc, multi-disc head, drive plate — in copper accent."),
("assembly-condo-slab-stack","d","/guides/reference-condominium-concrete-slab",
 "Cross-section of a condominium floor assembly over a concrete slab — the slab, the moisture and adhesive layer, the acoustic underlay, and an engineered board with its hardwood wear layer over a cross-laminated core.",
 "What goes over a slab, in order. The wear layer is real hardwood; the core beneath it is plies laid at ninety degrees to each other, which is what holds the board dimensionally stable over concrete.",
 "A cutaway cross-section through a slab floor assembly, every layer a distinct band, alternating ply directions clear, the wear layer in copper accent."),
("gap-midfield-obstructions","d","/guides/reference-condominium-concrete-slab",
 "Plan view of a floor with the expansion gap held open not only at every wall but also around a structural column, a kitchen island and a pipe penetration in the middle of the floor.",
 "Expansion gaps are missed at fixed objects mid-field far more often than at the perimeter. Every fixed object in the field is a wall as far as the floor is concerned.",
 "Overhead plan of a hardwood floor with a continuous open channel at every wall and running unbroken around a column, an island and a pipe penetration, every channel in copper accent."),
("depth-three-refinishing-services","d","/hardwood-floor-refinishing-toronto",
 "Three identical boards in section showing how much material each service removes — a screen and recoat taking only the finish, a full sand and finish going to bare wood, and replacement removing the board entirely.",
 "The difference between the three services is a depth. A screen and recoat abrades the existing finish and adds a new coat; a full sand goes to bare wood; replacement is a different job altogether.",
 "Three identical board sections in flat elevation, each showing a different depth of material removed, the removed material in copper accent."),
("wear-layer-refinish-budget","d","/hardwood-floor-refinishing-toronto",
 "A solid board and an engineered board drawn in section, each marked with how much thickness a refinishing cycle consumes and how many cycles the remaining material allows.",
 "How many times a floor can be refinished is a thickness budget. A solid board carries a generational wear layer above the tongue; an engineered board carries a specified wear-layer thickness and no more.",
 "Two board sections side by side, the solid board's material above the tongue subdivided into many thin slices and the engineered board's thin wear layer into only two or three, slices in copper accent."),
("symptom-cause-tree","d","/hardwood-floor-problems-toronto",
 "A branching diagram with moisture at the root splitting into five outcomes — cupping, seasonal gapping, crowning, buckling and edge peaking — each drawn as the board profile it produces.",
 "Five symptoms, one mechanism. Cupping, winter gaps, crowning, buckling and peeling finish are different visible outcomes of moisture moving through a floor, which is why the diagnosis starts with a reading and not a look.",
 "A branching structure reading left to right, one trunk in copper accent splitting into five branches, each ending in a board-section vignette of a distinct deformation."),
("protocol-timeline-install","d","/services/hardwood-installation",
 "A project timeline for a typical main-floor installation running left to right through moisture testing, acclimation, installation, sanding, staining and finishing, with the point at which the floor can be walked on marked near the end.",
 "A standard 1,000–1,500 sq ft installation takes 5 to 7 working days: moisture testing and acclimation, installation, then sanding, staining and finishing. The constraint at the end is cure time, not dust.",
 "A horizontal timeline band divided into six unequal consecutive segments each carrying a small activity pictogram, with a distinct vertical marker near the right end in copper accent."),
("price-bands-to-scale","d","/guides/hardwood-flooring-cost-toronto",
 "The three published price bands drawn as horizontal ranges on one common scale, so the overlap between screen and recoat, full sand and finish, and new installation is visible as distance.",
 "Three services, three ranges, one scale. The published bands are per square foot and the span between the cheapest intervention and a new floor is roughly sevenfold — which is why “what does hardwood cost” has no single answer.",
 "Three horizontal range bars stacked against one shared baseline, each starting and ending at different points, the longest in copper accent. No axis ticks, no scale markings."),
("change-order-drift","d","/guides/hardwood-flooring-cost-toronto",
 "Two quotes tracked over the life of a job — a low initial bid climbing in steps as omitted scope reappears as change orders, and a complete fixed price running flat from start to finish.",
 "Pattern multipliers and stair counts omitted from a quote reappear as change orders. The lowest bid that skips substrate language is usually incomplete scope, not a bargain.",
 "Two lines tracked left to right against a shared baseline: one starting low and climbing in abrupt steps past the other, one running perfectly flat, the stepped line in copper accent."),
("pattern-layout-three","d","/guides/herringbone-chevron-parquet-toronto",
 "Three floor patterns drawn in plan from directly above — straight-lay boards, herringbone, and chevron — showing how the cut and the joint differ between them.",
 "Straight-lay, herringbone and chevron. Herringbone meets at a right angle with square-cut ends; chevron meets in a point with mitred ends, and the cutting is where the labour difference lives.",
 "Three square panels of hardwood floor in overhead plan — parallel staggered boards, right-angle interlocking zigzag with square-cut ends, and a continuous mitred V down a central spine — one joint in each in copper accent."),
("radiant-failure-delay","d","/guides/reference-radiant-heat-main-floor",
 "A time axis comparing how quickly different specification errors show — most appearing within the first season, and solid hardwood over radiant heat appearing only after years of thermal cycling.",
 "Solid hardwood over radiant is the specification error with the longest delay before it shows. Thermal cycling compounds the seasonal humidity swing rather than replacing it, so the floor fails slowly and late.",
 "A horizontal time axis with several markers clustered at the left and one far to the right, board-section vignettes above each, and a wave form beneath growing in amplitude left to right, the distant marker and wave in copper accent."),
("acoustic-three-methods","d","/guides/nail-down-glue-down-or-floating",
 "Three floor assemblies in section over a concrete slab with the unit below shown, comparing how sound travels through nailed, glued and floating construction.",
 "The fixing method decides what the neighbour below hears. A floating assembly is the one that introduces a break between the finished floor and the structure — which is why condominium rules usually specify it.",
 "Three floor assemblies in section over identical slabs with a room volume beneath, a wave form travelling downward through each — unbroken in the first two, interrupted at the resilient layer in the third — waves in copper accent."),
("map-service-areas-gta","d","/service-areas",
 "A simplified map of Toronto and the surrounding Greater Toronto Area with the thirty-two service areas marked, and the lakeshore and the main highway spines shown for orientation.",
 "Thirty-two municipalities and neighbourhoods across Toronto and the GTA. What changes by address is the housing stock and the substrate under it, which is what each area page is for.",
 "A stylised flat map of the Greater Toronto Area, lake edge as one clean curve, highway corridors as straight spines, municipal outlines simple, thirty-two locations as filled dots in copper accent. No place names, no legend, no compass, no scale bar."),
("concept-acclimation-72h","p","/services/hardwood-installation",
 "Bundles of hardwood boards cross-stacked in a finished, conditioned room with air moving between every layer, and a hygrometer showing the room's condition beside them.",
 "Acclimation is the period during which flooring material equalises to the conditions of the room it will be installed in — a minimum of 72 hours, in the actual conditioned space, not in a garage or a hallway.",
 "Photorealistic finished furnished living room with three bundles of oak flooring cross-stacked in open lattice layers on the finished floor, clear air space between every layer, a digital hygrometer beside them."),
("concept-document-set","p","/framework",
 "The four documents a homeowner should have before a deposit — a moisture record sheet showing subfloor and material readings, a fixed-price estimate, a stated operating humidity band, and a signed contract.",
 "What to ask for before any deposit: written moisture readings of both the subfloor and the material, a fixed price, the humidity band the floor is specified for, and a signature. Documents shown are illustrative examples, not a client's paperwork.",
 "Photorealistic overhead desk scene with four printed documents in a slight fan — a two-value record sheet, an itemised estimate with a boxed total, a specification sheet showing a range, and a contract page with a pen on a completed signature line. All content generic and illustrative."),
]

def dims(i):
    out = subprocess.check_output(["identify","-format","%w %h", os.path.join(ILL, i + ".webp")]).decode().split()
    return int(out[0]), int(out[1])

ids = [(sid + v, h, href, alt, cap, pr + ("" if v == "" else " Second interpretation of the same brief."))
       for sid, h, href, alt, cap, pr in S for v in ("", "-b")]

missing = [i for i, *_ in ids if not os.path.exists(os.path.join(ILL, i + ".webp"))]
if missing:
    sys.exit("files not on disk — run integrate-batch2.sh first:\n  " + "\n  ".join(missing))

src = open(MAN, encoding="utf8").read()
q = lambda s: "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"

new_dims, new_hrefs, new_slots = [], [], []
for i, h, href, alt, cap, pr in ids:
    if f"'{i}'" in src:
        continue
    w, ht = dims(i)
    new_dims.append(f"  '{i}': [{w}, {ht}],")
    new_hrefs.append(f"  '{i}': '{href}',")
    new_slots.append(f"  {h}(\n    {q(i)},\n    {q(alt)},\n    {q(cap)},\n    {q(pr)},\n  ),")

if not new_slots:
    print("nothing to add — all 44 ids already in the manifest"); sys.exit(0)

BANNER = """
  /* ── BATCH 2 — 22 subjects, two independent interpretations each ────────
   * Two agents were given the same brief and returned two different pictures
   * of the same fact. `<id>` and `<id>-b` share alt text and caption because
   * they assert the SAME information; FigureRotator alternates them.
   * Dimensions are measured after scripts/prepare-illustrations.sh, not
   * guessed — the trim gives every file its own aspect ratio.
   */"""

src = src.replace("const DIMS: Record<string, [number, number]> = {",
                  "const DIMS: Record<string, [number, number]> = {\n" + "\n".join(new_dims), 1)
src = src.replace("const HREFS: Record<string, string> = {",
                  "const HREFS: Record<string, string> = {\n" + "\n".join(new_hrefs), 1)
m = list(re.finditer(r"^\];$", src, re.M))
end = next(x for x in m if x.start() > src.index("export const IMAGES: SiteImage[] = ["))
src = src[:end.start()] + BANNER + "\n" + "\n".join(new_slots) + "\n" + src[end.start():]

open(MAN, "w", encoding="utf8").write(src)
print(f"added {len(new_slots)} slot(s) to apps/web/lib/images.ts")
