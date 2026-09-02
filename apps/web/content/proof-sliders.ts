/**
 * content/proof-sliders.ts — the one registry behind every before/after slider.
 *
 * WHAT THESE FRAMES ARE
 *
 * Generated illustrations of the KINDS of work this company sells. Not
 * photographs. apps/web/lib/images.ts is explicit that `kind: 'photograph'`
 * means a camera pointed at something real, with provenance, and
 * verify-images.mjs fails the build on a lie. Every caption here describes a
 * type of job. None names an address, a customer or a price.
 *
 * FOUR ARCHIVES, ONE REGISTRY
 *
 * Two packs arrived with overlapping subjects and different conventions, and
 * the difference between them is measurable rather than aesthetic:
 *
 *   slider packs   16 pairs, every frame 1920x1280, exactly 3:2, locked camera
 *   proof packs    13 plates at 1168x784, one pair portrait, one pair whose two
 *                  frames were DIFFERENT SIZES (1712x1152 against 1168x784)
 *
 * A comparison handle cannot track across two different pixel grids, so the
 * mismatch was a functional defect, not a preference — and five proof plates
 * carried `status: 'recapture'`, meaning the camera drifted between frames.
 * The slider pairs have neither problem.
 *
 * So the images come from the slider packs and the WORDS come from the proof
 * packs, which is where the considered copy lives — headline, factline, both
 * alts, the route lists, the CTA. Nothing was rewritten to fit.
 *
 * Two subjects exist only in the proof packs and are kept from them:
 * `problems-cupping` and `screen-recoat`. And `dust-free-occupied` keeps its
 * proof frames deliberately: only that pack has a DURING frame, and
 * containment-up is the entire point of that placement.
 *
 * WHY beforeKey/afterKey AND NOT A URL
 *
 * Both briefs specify `/images/sliders/<id>.webp` and `/proof/<file>.webp`.
 * Those are 404s on this host. audit/FINDINGS.md F-131 measured it:
 * /qr-app.jpg from the repo-root public/ returns 200; /icon-192.png from
 * apps/web/public has 404'd since long before this work, and so did every
 * illustration written there. The keys index SLIDER_FRAMES in
 * app/data/slider-images.ts, which statically imports each file so Next
 * bundles it. 108 photographs and 135 diagrams already render on the live site
 * for exactly this reason.
 */
import { SLIDER_FRAMES } from '@/app/data/slider-images';
import type { StaticImageData } from 'next/image';

export type ProofHandle = 'before' | 'after' | 'during';

export type ProofPlate = {
  id: string;
  kicker: 'PROOF';
  headline: string;
  factline: string;
  instruction: string;
  leftHandle: ProofHandle;
  rightHandle: ProofHandle;
  /** Keys into SLIDER_FRAMES. Never a URL — see the note above. */
  beforeKey: string;
  afterKey: string;
  /** Describes the information in the frame, never "an image of…". */
  beforeAlt: string;
  afterAlt: string;
  /** Only where a case study is actually published. Never invented. */
  jobSlug?: string;
  routes: readonly string[];
  ctaHref?: string;
  ctaLabel?: string;
  /** Which archive the frames came from. Recorded, not decorative. */
  source: 'slider-pack' | 'proof-pack';
};

/*
 * TWO ROUTES REMOVED FROM THE SUPPLIED REGISTRY, AND WHY.
 *
 * proof-plates.ts shipped `herringboneCondo` and `customInlay` with '/design'
 * and '/library' in their route lists. Two of the three briefs forbid exactly
 * those pages — "DO NOT put sliders on /papers /glossary /data /framework
 * /library /design", and again "/library diagrams, /design configurator …
 * those pages win as engineering. A beauty slider there cheapens the corpus."
 *
 * The third brief asked for a new "Before / After plates" group in /library and
 * a herringbone slider in /design. That may well be the better product call —
 * but it is a decision, not a detail, and the prohibition is stated twice and
 * reasoned once. The routes are removed and verify-sliders.mjs enforces it.
 * Putting them back is one line in each entry plus a change to FORBIDDEN in the
 * guard, which is the right amount of friction for reversing a stated rule.
 */
export const PROOF_PLATES = {
  richmondHillMaple: {
    id: 'richmond-hill-maple',
    kicker: 'PROOF',
    headline: 'Same maple. Same condo. Different floor.',
    factline:
      'Occupied Richmond Hill unit, dust-contained sand, waterborne two-component finish. The owner slept there.',
    instruction: 'Drag the slider.',
    leftHandle: 'before',
    rightHandle: 'after',
    beforeKey: '01-richmond-hill-maple-condo-before',
    afterKey: '01-richmond-hill-maple-condo-after',
    beforeAlt:
      'Worn grey maple strip floor in an empty Richmond Hill condo, late-afternoon light from the left window.',
    afterAlt:
      'The same condo after a dust-contained maple refinish: honey satin waterborne finish, sheer curtains, one walnut chair.',
    routes: [
      '/',
      '/hardwood-floor-refinishing-toronto',
      '/service-areas/richmond-hill',
    ],
    ctaHref: '/case-studies',
    ctaLabel: 'See the work',
    source: 'slider-pack',
  },
  forestHillWalnut: {
    id: 'forest-hill-walnut',
    kicker: 'PROOF',
    headline: 'Same room. Same mantel. Different floor.',
    factline:
      'Forest Hill Edwardian, 8–12 inch black walnut, oil finish. The substrate was measured before a single board was laid.',
    instruction: 'Drag the slider.',
    leftHandle: 'before',
    rightHandle: 'after',
    beforeKey: '02-forest-hill-walnut-wideplank-before',
    afterKey: '02-forest-hill-walnut-wideplank-after',
    beforeAlt:
      'Forest Hill living room before installation: plywood subfloor, blue painter tape, original dark wood mantel.',
    afterAlt:
      'The same Forest Hill room after a wide-plank black walnut install, oil-rubbed satin sheen, original mantel retained.',
    jobSlug: 'forest-hill-walnut-wide-plank-color-stability',
    routes: [
      '/hardwood-flooring-toronto',
      '/case-studies/forest-hill-walnut-wide-plank-color-stability',
      '/service-areas/forest-hill',
    ],
    ctaHref: '/case-studies/forest-hill-walnut-wide-plank-color-stability',
    ctaLabel: 'Read what was measured',
    source: 'slider-pack',
  },
  rosedaleStairs: {
    id: 'rosedale-stairs',
    kicker: 'PROOF',
    headline: 'Same flight. Same window. Different stairs.',
    factline:
      'Quoted per tread, not per square foot. The nosing is where cheap work shows.',
    instruction: 'Drag the slider.',
    leftHandle: 'before',
    rightHandle: 'after',
    beforeKey: '04-rosedale-stairs-radiant-before',
    afterKey: '04-rosedale-stairs-radiant-after',
    beforeAlt:
      'Worn painted stair treads with scuffed nosings and a dull oak handrail, looking up toward a landing window.',
    afterAlt:
      'The same flight after refinishing: white oak treads, painted risers, new oak handrail and newel, landing window unchanged.',
    jobSlug: 'rosedale-estate-stairs-radiant-heat',
    routes: [
      '/hardwood-stairs-toronto',
      '/case-studies/rosedale-estate-stairs-radiant-heat',
      '/service-areas/rosedale',
    ],
    ctaHref: '/case-studies/rosedale-estate-stairs-radiant-heat',
    ctaLabel: 'Read what was measured',
    source: 'slider-pack',
  },
  dustFreeOccupied: {
    id: 'dust-free-occupied',
    kicker: 'PROOF',
    headline: 'They stayed home. The floor still changed.',
    factline:
      'HEPA at the tool. Zip-wall at the opening. Furniture bagged, not removed.',
    instruction: 'Drag the slider.',
    leftHandle: 'during',
    rightHandle: 'after',
    beforeKey: 'dust-free-occupied-during',
    afterKey: 'dust-free-occupied-after',
    beforeAlt:
      'Occupied Toronto living room mid-job: sofa and bookcase under plastic, HEPA extractor on the floor, zip-wall at the doorway.',
    afterAlt:
      'The same lived-in room after dust-free maple refinishing, furniture returned, satin floor in afternoon light.',
    routes: [
      '/services/dust-free-sanding',
      '/commercial',
    ],
    ctaHref: '/services/dust-free-sanding',
    ctaLabel: 'What dust-free actually means',
    source: 'proof-pack',
  },
  realtorPrelist: {
    id: 'realtor-prelist',
    kicker: 'PROOF',
    headline: 'The MLS photo is taken on day three.',
    factline:
      'Orange builder stain to natural satin. Photography after the sheen settles — not before.',
    instruction: 'Drag the slider.',
    leftHandle: 'before',
    rightHandle: 'after',
    beforeKey: '06-richmond-hill-builder-oak-before',
    afterKey: '06-richmond-hill-builder-oak-after',
    beforeAlt:
      'Empty listing room with dated orange-red high-gloss oak, scratches and traffic lanes, sliding door to a deck.',
    afterAlt:
      'The same listing room after a full sand and lighter satin finish, ready for photography.',
    routes: [
      '/realtors',
    ],
    ctaHref: '/realtors',
    ctaLabel: 'Pre-list floor recoat',
    source: 'slider-pack',
  },
  distilleryLoft: {
    id: 'distillery-loft',
    kicker: 'PROOF',
    headline: 'Same loft. Same brick. Different floor.',
    factline:
      'Distillery District Victorian loft. White oak engineered, glue-down over a measured concrete slab.',
    instruction: 'Drag the slider.',
    leftHandle: 'before',
    rightHandle: 'after',
    beforeKey: '09-distillery-whiteoak-slab-before',
    afterKey: '09-distillery-whiteoak-slab-after',
    beforeAlt:
      'Raw Distillery District loft: factory windows, exposed brick, stained concrete slab before hardwood.',
    afterAlt:
      'The same loft after a white oak glue-down over concrete, matte oil finish, one lounge chair.',
    jobSlug: 'distillery-district-victorian-condo',
    routes: [
      '/case-studies/distillery-district-victorian-condo',
      '/service-areas',
      '/commercial',
      '/hardwood-flooring-toronto',
    ],
    ctaHref: '/case-studies/distillery-district-victorian-condo',
    ctaLabel: 'Read what was measured',
    source: 'slider-pack',
  },
  problemsCupping: {
    id: 'problems-cupping',
    kicker: 'PROOF',
    headline: 'The gap is climate. The grey is finish.',
    factline:
      'Winter gapping and oxidized wear on maple, then a full sand and waterborne finish. Board-level crop — not a hero.',
    instruction: 'Drag the slider.',
    leftHandle: 'before',
    rightHandle: 'after',
    beforeKey: 'problems-cupping-before',
    afterKey: 'problems-cupping-after',
    beforeAlt:
      'Close-up of a failing Toronto hardwood floor: grey oxidized boards, open winter gaps, surface wear.',
    afterAlt:
      'Close-up of the same floor after repair, sanding and refinishing: tight seams, flat boards, honey satin maple.',
    routes: [
      '/hardwood-floor-problems-toronto',
    ],
    ctaHref: '/hardwood-floor-problems-toronto',
    ctaLabel: 'Why floors fail here',
    source: 'proof-pack',
  },
  yorkvilleBasement: {
    id: 'yorkville-basement',
    kicker: 'PROOF',
    headline: 'Same slab. Same window. Different floor.',
    factline:
      'Yorkville loft, below grade. Moisture mitigated on the slab, then red oak with hard-maple accent stripes.',
    instruction: 'Drag the slider.',
    leftHandle: 'before',
    rightHandle: 'after',
    beforeKey: '03-yorkville-loft-moisture-before',
    afterKey: '03-yorkville-loft-moisture-after',
    beforeAlt:
      'Yorkville below-grade room before hardwood: stained concrete slab, high window on the left, painted ductwork.',
    afterAlt:
      'The same below-grade room after engineered hardwood: red oak field with hard-maple accent stripes, satin finish.',
    jobSlug: 'yorkville-loft-basement-conversion-moisture-mitigation',
    routes: [
      '/case-studies/yorkville-loft-basement-conversion-moisture-mitigation',
      '/service-areas/yorkville',
      '/hardwood-flooring-toronto',
      '/services',
    ],
    ctaHref: '/case-studies/yorkville-loft-basement-conversion-moisture-mitigation',
    ctaLabel: 'Read what was measured',
    source: 'slider-pack',
  },
  midtownTownhouse: {
    id: 'midtown-townhouse',
    kicker: 'PROOF',
    headline: 'Three levels. One continuous floor.',
    factline:
      'Midtown townhouse. Ground-floor maple meeting white oak treads and a walnut stringer. The join is the job.',
    instruction: 'Drag the slider.',
    leftHandle: 'before',
    rightHandle: 'after',
    beforeKey: '05-midtown-townhouse-continuous-before',
    afterKey: '05-midtown-townhouse-continuous-after',
    beforeAlt:
      'Midtown townhouse before work: grey worn ground floor, mismatched stair treads, visible height change at the first step.',
    afterAlt:
      'The same landing after work: continuous hardwood into white oak treads with a walnut stringer and no cheap transition strip.',
    jobSlug: 'midtown-townhouse-three-level-transition',
    routes: [
      '/case-studies/midtown-townhouse-three-level-transition',
      '/service-areas/midtown-toronto',
      '/',
      '/hardwood-stairs-toronto',
    ],
    ctaHref: '/case-studies/midtown-townhouse-three-level-transition',
    ctaLabel: 'Read what was measured',
    source: 'slider-pack',
  },
  screenRecoat: {
    id: 'screen-recoat',
    kicker: 'PROOF',
    headline: 'Same colour. New skin.',
    factline:
      'Screen and recoat only — $2.50–$4.00 per sq ft. Light abrasion, fresh topcoat, no full sand, no colour change.',
    instruction: 'Drag the slider.',
    leftHandle: 'before',
    rightHandle: 'after',
    beforeKey: 'screen-recoat-before',
    afterKey: 'screen-recoat-after',
    beforeAlt:
      'Sound maple floor with dull tired finish, micro-scratches and grey traffic lanes. Colour unchanged.',
    afterAlt:
      'The same maple floor after a screen and recoat: even satin sheen, traffic lanes gone, colour unchanged.',
    routes: [
      '/hardwood-floor-refinishing-toronto',
      '/realtors',
      '/',
    ],
    ctaHref: '/hardwood-floor-refinishing-toronto',
    ctaLabel: 'Which service the floor needs',
    source: 'proof-pack',
  },
  herringboneCondo: {
    id: 'herringbone-condo',
    kicker: 'PROOF',
    headline: 'Same condo. Different geometry.',
    factline:
      'Builder carpet out. White oak herringbone in. Pattern install is a different buyer than a straight-lay refinish.',
    instruction: 'Drag the slider.',
    leftHandle: 'before',
    rightHandle: 'after',
    beforeKey: '08-herringbone-walnut-border-before',
    afterKey: '08-herringbone-walnut-border-after',
    beforeAlt:
      'Empty Toronto high-rise living room with beige wall-to-wall carpet and a full-width city window.',
    afterAlt:
      'The same condo after a white oak herringbone install, natural satin finish, one lounge chair.',
    routes: [
      '/hardwood-flooring-toronto',
      '/guides',
    ],
    ctaHref: '/design',
    ctaLabel: 'Build the floor',
    source: 'slider-pack',
  },
  customInlay: {
    id: 'custom-inlay',
    kicker: 'PROOF',
    headline: 'The floor can have a signature.',
    factline:
      'Custom inlay and border, routed and fitted by hand. Quoted per project, never buried in a square-foot rate.',
    instruction: 'Drag the slider.',
    leftHandle: 'before',
    rightHandle: 'after',
    beforeKey: '13-medallion-walnut-maple-before',
    afterKey: '13-medallion-walnut-maple-after',
    beforeAlt:
      'Toronto foyer with a plain worn straight-lay oak floor running from the front door down the hall.',
    afterAlt:
      'The same foyer after a walnut and maple compass-rose medallion inlay framed by a contrasting border.',
    routes: [
      '/services',
    ],
    ctaHref: '/services',
    ctaLabel: 'Custom inlays and borders',
    source: 'slider-pack',
  },
  restorationWater: {
    id: 'restoration-water',
    kicker: 'PROOF',
    headline: 'The black boards do not get sanded over.',
    factline:
      'Water-damaged ends replaced, then the whole floor sanded and finished. Restoration is not a refinish with hope.',
    instruction: 'Drag the slider.',
    leftHandle: 'before',
    rightHandle: 'after',
    beforeKey: '10-kitchen-water-restoration-before',
    afterKey: '10-kitchen-water-restoration-after',
    beforeAlt:
      'Dining room hardwood with water-blackened board ends at a patio door and peeling finish in patches.',
    afterAlt:
      'The same room after board replacement, full sand and satin finish. Damage gone, floor continuous.',
    routes: [
      '/hardwood-floor-problems-toronto',
      '/services',
      '/hardwood-floor-refinishing-toronto',
    ],
    ctaHref: '/hardwood-floor-problems-toronto',
    ctaLabel: 'Why floors fail here',
    source: 'slider-pack',
  },
  occupiedLivingRefinish: {
    id: 'occupied-living-refinish',
    kicker: 'PROOF',
    headline: 'Same room. Same furniture. Different floor.',
    factline:
      'A furnished living room refinished in place. The sofa moved one room over and came back.',
    instruction: 'Drag the slider.',
    leftHandle: 'before',
    rightHandle: 'after',
    beforeKey: '11-occupied-living-refinish-before',
    afterKey: '11-occupied-living-refinish-after',
    beforeAlt:
      'A furnished living room with a dulled, traffic-worn strip floor and furniture still in place.',
    afterAlt:
      'The same furnished living room after refinishing, the floor even in sheen from wall to wall.',
    routes: [
      '/guides/dustless-hardwood-refinishing-toronto',
    ],
    source: 'slider-pack',
  },
  kingWestWhiteOak: {
    id: 'kingwest-whiteoak-condo',
    kicker: 'PROOF',
    headline: 'Same slab. New floor.',
    factline:
      'Engineered white oak over a concrete slab in a new-build condominium.',
    instruction: 'Drag the slider.',
    leftHandle: 'before',
    rightHandle: 'after',
    beforeKey: '12-kingwest-whiteoak-condo-before',
    afterKey: '12-kingwest-whiteoak-condo-after',
    beforeAlt:
      'A bare concrete slab in a new-build condominium unit before any floor is laid.',
    afterAlt:
      'The same unit after engineered white oak was laid over the slab, boards running to the window wall.',
    routes: [
      '/commercial',
    ],
    source: 'slider-pack',
  },
  radiantMapleSunroom: {
    id: 'radiant-maple-sunroom',
    kicker: 'PROOF',
    headline: 'Same sunroom. A floor that lives with the heat.',
    factline:
      'Maple over a radiant-heated main floor, specified for the temperature swing rather than against it.',
    instruction: 'Drag the slider.',
    leftHandle: 'before',
    rightHandle: 'after',
    beforeKey: '14-radiant-maple-sunroom-before',
    afterKey: '14-radiant-maple-sunroom-after',
    beforeAlt:
      'A sunroom with an aged, gapped maple floor over a radiant-heated slab.',
    afterAlt:
      'The same sunroom after a maple floor specified and laid for radiant heat, gaps closed and finish even.',
    routes: [
      '/guides/reference-radiant-heat-main-floor',
    ],
    source: 'slider-pack',
  },
  condoCorridorCommercial: {
    id: 'condo-corridor-commercial',
    kicker: 'PROOF',
    headline: 'Same corridor. Different floor.',
    factline:
      'A condominium corridor refinished between resident traffic, section by section.',
    instruction: 'Drag the slider.',
    leftHandle: 'before',
    rightHandle: 'after',
    beforeKey: '15-condo-corridor-commercial-before',
    afterKey: '15-condo-corridor-commercial-after',
    beforeAlt:
      'A condominium corridor with a scuffed, unevenly worn hardwood floor along the traffic line.',
    afterAlt:
      'The same corridor after refinishing, the wear line gone and sheen consistent down its length.',
    routes: [
      '/commercial',
    ],
    source: 'slider-pack',
  },
  heritageBayWindowOak: {
    id: 'heritage-baywindow-oak',
    kicker: 'PROOF',
    headline: 'Same bay window. The boards were kept.',
    factline:
      'A heritage bay window where the original oak was repaired and refinished rather than replaced.',
    instruction: 'Drag the slider.',
    leftHandle: 'before',
    rightHandle: 'after',
    beforeKey: '16-heritage-baywindow-oak-before',
    afterKey: '16-heritage-baywindow-oak-after',
    beforeAlt:
      'A heritage bay-window alcove with damaged, cupped original oak boards and open seams.',
    afterAlt:
      'The same bay-window alcove after board repair and refinishing, the original oak retained.',
    routes: [
      '/hardwood-floor-problems-toronto',
    ],
    source: 'slider-pack',
  },} as const satisfies Record<string, ProofPlate>;

export type ProofPlateId = keyof typeof PROOF_PLATES;

/** The homepage slider. One, above the JobCardRail — not a carousel. */
export const HOMEPAGE_PLATE: ProofPlateId = 'richmondHillMaple';

/** Resolve a plate's two frames to bundled images. Throws rather than 404s. */
export function plateFrames(plate: ProofPlate): { before: StaticImageData; after: StaticImageData } {
  const before = SLIDER_FRAMES[plate.beforeKey];
  const after = SLIDER_FRAMES[plate.afterKey];
  if (!before || !after) {
    throw new Error(
      `proof-sliders: "${plate.id}" names a frame that is not imported ` +
        `(${plate.beforeKey} / ${plate.afterKey}). Run: node scripts/gen-slider-imports.mjs`,
    );
  }
  return { before, after };
}

/** Every plate that names a given route, in registry order. */
export const platesForRoute = (route: string): ProofPlate[] =>
  // `as const` narrows every route to a literal, so `includes` would demand a
  // member of that union. The argument is a runtime string, so the array is
  // widened for the test rather than the registry being loosened.
  (Object.values(PROOF_PLATES) as readonly ProofPlate[]).filter((p) =>
    (p.routes as readonly string[]).includes(route),
  );
