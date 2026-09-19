/**
 * lib/trilogies.ts — THE 20-TRILOGY PHOTO SET. Single source of truth.
 *
 * WHAT THIS IS
 *
 * Twenty real Ecowoods site jobs, each photographed in three frames that tell
 * one story: the room, then the approach, then the fingertip — a shot wide
 * enough to place the work, one that walks the camera in, and one close
 * enough to be the actual joint. Every page that shows one of these pulls
 * from here. No one-off copy lives in a page component.
 *
 * PROVENANCE — kind:photograph, and what backs that claim
 *
 * These are real camera photographs of real Ecowoods jobs, restored for the
 * web (see the delivered `catalog/ECOWOODS_IMAGE_CATALOG.md`, "Source
 * discipline": architecture, stair geometry, baluster ornament and floor
 * pattern were not redesigned; correction was limited to noise, exposure,
 * verticals and removing capture debris — construction tape, cable coils,
 * date stamps). That is the provenance recorded on every entry below. This is
 * a different register from the colour-matching pack in
 * data/color-matching-images.ts, which is `kind: 'illustration'` — generated
 * photoreal frames, explicitly not camera photographs. Never blur that line
 * in either direction.
 *
 * ONE NAME THAT IS DELIBERATELY NOT HERE
 *
 * The delivered filenames and catalog documentation name the commercial job
 * "Ricki's". This repository does not already name that job anywhere
 * (checked: no match for "ricki" in apps/web or packages before this file was
 * written), and the brief that supplied this copy said to use the name only
 * if the repo already did. So the two commercial entries below say "retail
 * maple, GTA" and a mall storefront, never the name — the slug stays a stable
 * id (`rickis-store-maple-strip`, `rickis-storefront`) because renaming it
 * now would break every inbound link for no reason the copy itself needs.
 *
 * "/case-studies/..." BECAME "/projects/..." FOR FOUR TRILOGIES
 *
 * The brief that supplied this set routed four trilogies (floral-medallion,
 * library-chevron, geometric-versailles-parquet-estate, paneled-oval-room) to
 * /case-studies/<slug>. lib/content/case-study-types.ts requires square
 * footage, substrate type, species, and moisture readings for a case study —
 * exactly the numbers nobody took for a photo set, and exactly the failure
 * this site already cleaned up once (five case studies carrying invented
 * measurements, see the note atop content/projects/maple-vaughan-curved-stair.ts).
 * These four route to /projects/<slug> instead, the same honest "a set of
 * photographs, asserting only what the frames show" contract the one existing
 * project already uses. A repo fact overrides a brief assumption; the routes
 * below reflect where the pages actually are.
 */
import type { StaticImageData } from 'next/image';
import { trilogyImage } from '@/app/data/trilogy-images';

export type TrilogyFrame = {
  id: '01' | '02' | '03';
  src: StaticImageData;
  alt: string;
  caption: string;
  beat: string;
};

export type TrilogyKind = 'hero' | 'inlay' | 'stairs' | 'residential' | 'commercial' | 'detail' | 'grand';

export type Trilogy = {
  slug: string;
  kicker: string;
  headline: string;
  lede: string;
  body: string;
  routes: string[];
  kind: TrilogyKind;
  frames: [TrilogyFrame, TrilogyFrame, TrilogyFrame];
  /** Real camera provenance — every entry here carries one. See file header. */
  provenance: string;
};

const PROVENANCE =
  'Restored Ecowoods site photograph. Architecture, stair geometry and floor pattern not redesigned; ' +
  'correction limited to exposure, noise, verticals and removing capture debris (construction tape, cable coils, date stamps).';

/** id → StaticImageData, throwing loudly at build time if a frame is missing rather than rendering a blank. */
function frame(slug: string, id: '01' | '02' | '03', alt: string, caption: string, beat: string): TrilogyFrame {
  const src = trilogyImage(`${slug}-${id}`);
  if (!src) throw new Error(`lib/trilogies.ts: missing trilogy frame ${slug}-${id} — run node scripts/gen-trilogy-imports.mjs`);
  return { id, src, alt, caption, beat };
}

export const TRILOGIES: Trilogy[] = [
  {
    slug: 'salon-dark-oak-chandelier',
    kicker: 'Estate oak · continuous plane',
    headline: 'The floor holds the room before the chandelier does.',
    lede:
      'A dark oak plane, sanded and finished as one surface, carrying the light from the doors and the fixture. This is what a finished floor is for: to make the architecture readable.',
    body:
      'Ecowoods installed and finished this oak so the boards run clean to the French doors. The first frame is the room as a visitor sees it. The second drops the camera to the sheen. The third is two boards and a joint — the only proof that matters.',
    routes: ['/', '/hardwood-flooring-toronto', '/library', '/projects/salon-dark-oak-chandelier'],
    kind: 'hero',
    frames: [
      frame('salon-dark-oak-chandelier', '01',
        'Dark oak salon floor running to French doors under a chandelier, frame 1 of 3, standing-height room view, Ecowoods site work, Toronto.',
        'Standing view. Oak plane, doors, chandelier.', 'The room'),
      frame('salon-dark-oak-chandelier', '02',
        'Dark oak salon floor, frame 2 of 3, camera at knee height toward the French doors, Ecowoods site work, Toronto.',
        'Knee height. The floor as a runway of light.', 'The approach'),
      frame('salon-dark-oak-chandelier', '03',
        'Dark oak salon floor, frame 3 of 3, macro of two boards and a joint under chandelier light, Ecowoods site work, Toronto.',
        'Two boards. One joint. Finish under chandelier light.', 'The grain'),
    ],
    provenance: PROVENANCE,
  },
  {
    slug: 'salon-fireplace-continuous-floor',
    kicker: 'Continuous oak · two rooms',
    headline: 'The same floor walks through the arch.',
    lede: 'Oak does not stop at the casing. It runs from the front salon into the fireplace room as one job.',
    body:
      'Most houses hide a change of floor under a threshold strip. Here the boards keep going. Frame one is both rooms. Frame two is the plank line that connects them. Frame three is the seam on that line.',
    routes: ['/', '/hardwood-flooring-toronto', '/library', '/projects/salon-fireplace-continuous-floor'],
    kind: 'hero',
    frames: [
      frame('salon-fireplace-continuous-floor', '01',
        'Oak floor running continuously through an archway between a salon and a fireplace room, frame 1 of 3, both rooms in view, Ecowoods site work, Toronto.',
        'Both rooms.', 'The rooms'),
      frame('salon-fireplace-continuous-floor', '02',
        'Continuous oak floor, frame 2 of 3, camera dropped onto the plank line walking through the arch into the fireplace room, Ecowoods site work, Toronto.',
        'Through the arch.', 'The approach'),
      frame('salon-fireplace-continuous-floor', '03',
        'Continuous oak floor, frame 3 of 3, macro of the seam where the plank line crosses the threshold, Ecowoods site work, Toronto.',
        'The seam.', 'The seam'),
    ],
    provenance: PROVENANCE,
  },
  {
    slug: 'geometric-parquet-french-doors',
    kicker: 'Geometric oak parquet',
    headline: 'Pattern first. Garden second.',
    lede: 'Light oak laid in a geometric parquet that reads all the way to the balcony doors. The floor is the room.',
    body:
      'Ecowoods cut and laid this parquet so the module repeats without drifting off the doors. The close frames are not decoration. They are the joint.',
    routes: ['/', '/hardwood-flooring-toronto', '/library', '/projects/geometric-parquet-french-doors'],
    kind: 'hero',
    frames: [
      frame('geometric-parquet-french-doors', '01',
        'Light oak geometric parquet floor running to French balcony doors, frame 1 of 3, standing room view, Ecowoods site work, Toronto.',
        'The room.', 'The room'),
      frame('geometric-parquet-french-doors', '02',
        'Geometric oak parquet, frame 2 of 3, camera walking into the repeating pattern toward the doors, Ecowoods site work, Toronto.',
        'Into the pattern.', 'The approach'),
      frame('geometric-parquet-french-doors', '03',
        'Geometric oak parquet, frame 3 of 3, macro of the module joint where the pattern meets, Ecowoods site work, Toronto.',
        'The meeting.', 'The joint'),
    ],
    provenance: PROVENANCE,
  },
  {
    slug: 'floral-medallion-inlay',
    kicker: 'Custom inlay',
    headline: 'A flower set into the oak, not printed on it.',
    lede: 'Contrasting woods let into the field floor. The medallion is joinery.',
    body:
      'Inlay work only holds if the field around it is flat, acclimated, and finished as one surface. These three frames move from the room to the petal.',
    routes: ['/library', '/projects/floral-medallion-inlay', '/hardwood-flooring-toronto'],
    kind: 'inlay',
    frames: [
      frame('floral-medallion-inlay', '01',
        'Floral medallion inlay set into an oak field floor, frame 1 of 3, standing room view, Ecowoods site work, Toronto.',
        'The room.', 'The room'),
      frame('floral-medallion-inlay', '02',
        'Floral medallion inlay, frame 2 of 3, camera dollying into the medallion, Ecowoods site work, Toronto.',
        'The signature.', 'The approach'),
      frame('floral-medallion-inlay', '03',
        'Floral medallion inlay, frame 3 of 3, macro of the flower, leaf and scroll inlay joinery, Ecowoods site work, Toronto.',
        'The petal.', 'The signature'),
    ],
    provenance: PROVENANCE,
  },
  {
    slug: 'geometric-border-parquet-study',
    kicker: 'Bordered parquet · study',
    headline: 'A dark line that keeps the oak in measure.',
    lede: 'Framed oak panels with a dark border, laid in a paneled room that already knew how to be quiet.',
    body: 'The border is the job. Get the intersections clean and the rest of the room can stay still.',
    routes: ['/library', '/projects/geometric-border-parquet-study'],
    kind: 'inlay',
    frames: [
      frame('geometric-border-parquet-study', '01',
        'Framed oak parquet panels with a dark border in a paneled study, frame 1 of 3, standing room view, Ecowoods site work, Toronto.',
        'The study.', 'The room'),
      frame('geometric-border-parquet-study', '02',
        'Bordered oak parquet, frame 2 of 3, camera skimming the framed panels and dark border rhythm, Ecowoods site work, Toronto.',
        'The rhythm.', 'The approach'),
      frame('geometric-border-parquet-study', '03',
        'Bordered oak parquet, frame 3 of 3, macro of the border crossing at a panel corner, Ecowoods site work, Toronto.',
        'The cross.', 'The joint'),
    ],
    provenance: PROVENANCE,
  },
  {
    slug: 'library-chevron-wide-band-parquet',
    kicker: 'Wide-band chevron',
    headline: 'Grain that turns at the hearth.',
    lede: 'Broad chevron bands aimed at a carved fireplace. Direction is the design.',
    body: 'Chevron fails in the last ten millimetres. Frame three is that joint.',
    routes: ['/library', '/projects/library-chevron-wide-band-parquet', '/hardwood-flooring-toronto'],
    kind: 'inlay',
    frames: [
      frame('library-chevron-wide-band-parquet', '01',
        'Wide-band chevron oak parquet in a library aimed at a carved fireplace, frame 1 of 3, standing room view, Ecowoods site work, Toronto.',
        'The library.', 'The room'),
      frame('library-chevron-wide-band-parquet', '02',
        'Wide-band chevron parquet, frame 2 of 3, camera following the chevron bands toward the hearth, Ecowoods site work, Toronto.',
        'Toward the hearth.', 'The approach'),
      frame('library-chevron-wide-band-parquet', '03',
        'Wide-band chevron parquet, frame 3 of 3, macro of the chevron point where two bands meet, Ecowoods site work, Toronto.',
        'The point.', 'The joint'),
    ],
    provenance: PROVENANCE,
  },
  {
    slug: 'geometric-versailles-parquet-estate',
    kicker: 'Versailles module',
    headline: 'One module, repeated until it is a room.',
    lede: 'Geometric oak parquet laid to the doors. The estate scale is just the module, done honestly.',
    body: 'Do not photograph a palace. Photograph one diamond and the boards that hold it.',
    routes: ['/library', '/projects/geometric-versailles-parquet-estate'],
    kind: 'inlay',
    frames: [
      frame('geometric-versailles-parquet-estate', '01',
        'Versailles-pattern oak parquet floor in an estate room running to French doors, frame 1 of 3, standing room view, Ecowoods site work, Toronto.',
        'The estate floor.', 'The room'),
      frame('geometric-versailles-parquet-estate', '02',
        'Versailles parquet, frame 2 of 3, one complete geometric module close enough to read every joint, Ecowoods site work, Toronto.',
        'One module.', 'The approach'),
      frame('geometric-versailles-parquet-estate', '03',
        'Versailles parquet, frame 3 of 3, macro of the diamond centre and its surrounding frame, Ecowoods site work, Toronto.',
        'The diamond.', 'The module'),
    ],
    provenance: PROVENANCE,
  },
  {
    slug: 'curved-oak-iron-balustrade',
    kicker: 'Curved oak stair',
    headline: 'The rail starts before the first riser finishes.',
    lede: 'Oak treads, a bent rail, twisted iron. The stair is a piece of furniture the house has to live with.',
    body:
      'Ecowoods builds the stair as one assembly: nosing, riser, rail, newel. Frame one is the climb. Frame two is the first steps. Frame three is the edge a hand and a foot both find.',
    routes: ['/hardwood-stairs-toronto', '/library', '/projects/curved-oak-iron-balustrade'],
    kind: 'stairs',
    frames: [
      frame('curved-oak-iron-balustrade', '01',
        'Curved oak stair with a bent handrail and ornamental iron balustrade, frame 1 of 3, full flight view from the foot of the stair, Ecowoods site work, Toronto.',
        'The climb.', 'The room'),
      frame('curved-oak-iron-balustrade', '02',
        'Curved oak stair, frame 2 of 3, camera at the first treads where the rail begins its climb, Ecowoods site work, Toronto.',
        'First steps.', 'The approach'),
      frame('curved-oak-iron-balustrade', '03',
        'Curved oak stair, frame 3 of 3, macro of the nosing edge where tread and rail meet a hand and a foot, Ecowoods site work, Toronto.',
        'The nosing.', 'The nosing'),
    ],
    provenance: PROVENANCE,
  },
  {
    slug: 'sculptural-handrail-curve',
    kicker: 'Steam-bent oak rail',
    headline: 'The part you actually touch.',
    lede: 'A continuous oak rail on the curve. Finish and grain have to survive a hand every day.',
    body: 'Stairs are judged at the rail. If the curve is fair and the finish is even, the rest of the flight can be quiet.',
    routes: ['/hardwood-stairs-toronto', '/library', '/projects/sculptural-handrail-curve'],
    kind: 'stairs',
    frames: [
      frame('sculptural-handrail-curve', '01',
        'Steam-bent oak handrail curving down a stair flight, frame 1 of 3, full flight view, Ecowoods site work, Toronto.',
        'The flight.', 'The room'),
      frame('sculptural-handrail-curve', '02',
        'Steam-bent oak handrail, frame 2 of 3, camera following the rail as it turns through the curve, Ecowoods site work, Toronto.',
        'The curve.', 'The approach'),
      frame('sculptural-handrail-curve', '03',
        'Steam-bent oak handrail, frame 3 of 3, macro of the rail profile at hand height, Ecowoods site work, Toronto.',
        'The hold.', 'The touch'),
    ],
    provenance: PROVENANCE,
  },
  {
    slug: 'foyer-oak-treads-iron',
    kicker: 'Oak on stone',
    headline: 'Wood has to meet tile without an argument.',
    lede: 'Bullnose oak sitting on cream stone. The foyer is two materials and one joint.',
    body: 'This is the detail clients notice when they take their shoes off. Frame three is the joint.',
    routes: ['/hardwood-stairs-toronto', '/library', '/projects/foyer-oak-treads-iron'],
    kind: 'stairs',
    frames: [
      frame('foyer-oak-treads-iron', '01',
        'Oak stair treads rising from a stone-tiled foyer with an iron rail, frame 1 of 3, full foyer view, Ecowoods site work, Toronto.',
        'The foyer.', 'The room'),
      frame('foyer-oak-treads-iron', '02',
        'Oak treads meeting stone foyer tile, frame 2 of 3, camera approaching the material transition, Ecowoods site work, Toronto.',
        'Stone to oak.', 'The approach'),
      frame('foyer-oak-treads-iron', '03',
        'Oak treads meeting stone foyer tile, frame 3 of 3, macro of the bullnose-to-stone joint, Ecowoods site work, Toronto.',
        'Wood and stone.', 'The joint'),
    ],
    provenance: PROVENANCE,
  },
  {
    slug: 'spiral-looking-down',
    kicker: 'Spiral oak',
    headline: 'Wedge treads around a single centre.',
    lede: 'Looking down the well. Each tread is a pie. The rail is the circle that keeps them honest.',
    body: 'A spiral is geometry first. Frame three is two wedges and the seam between them.',
    routes: ['/hardwood-stairs-toronto', '/library', '/projects/spiral-looking-down'],
    kind: 'stairs',
    frames: [
      frame('spiral-looking-down', '01',
        'Spiral oak stair seen from above looking down the stairwell, frame 1 of 3, full well view, Ecowoods site work, Toronto.',
        'The well.', 'The room'),
      frame('spiral-looking-down', '02',
        'Spiral oak stair, frame 2 of 3, camera tighter on the wedge treads and circling rail, Ecowoods site work, Toronto.',
        'The spiral.', 'The approach'),
      frame('spiral-looking-down', '03',
        'Spiral oak stair, frame 3 of 3, macro of two adjacent wedge treads and their seam, Ecowoods site work, Toronto.',
        'The wedge.', 'The joint'),
    ],
    provenance: PROVENANCE,
  },
  {
    slug: 'dark-oak-plank-living',
    kicker: 'Wide oak plank',
    headline: 'Boards aimed at the window.',
    lede: 'Dark oak running the length of the living rooms. The finish is how the daylight arrives.',
    body: 'A plank floor is only as good as the last seam and the last coat. That is frame three.',
    routes: ['/hardwood-flooring-toronto', '/hardwood-floor-refinishing-toronto', '/library', '/projects/dark-oak-plank-living'],
    kind: 'residential',
    frames: [
      frame('dark-oak-plank-living', '01',
        'Dark wide-plank oak floor running through connected living rooms toward a window, frame 1 of 3, standing room view, Ecowoods site work, Toronto.',
        'The rooms.', 'The room'),
      frame('dark-oak-plank-living', '02',
        'Dark wide-plank oak floor, frame 2 of 3, camera aimed down the boards toward daylight, Ecowoods site work, Toronto.',
        'Toward light.', 'The approach'),
      frame('dark-oak-plank-living', '03',
        'Dark wide-plank oak floor, frame 3 of 3, macro of the board seam and finish sheen, Ecowoods site work, Toronto.',
        'The sheen.', 'The finish'),
    ],
    provenance: PROVENANCE,
  },
  {
    slug: 'oak-hallway-closet-transition',
    kicker: 'Threshold',
    headline: 'The floor does not end at the closet door.',
    lede: 'Oak through the casing. Stone stops. Wood continues.',
    body: 'Transitions are where cheap jobs confess. This one does not.',
    routes: ['/hardwood-flooring-toronto', '/library', '/projects/oak-hallway-closet-transition'],
    kind: 'residential',
    frames: [
      frame('oak-hallway-closet-transition', '01',
        'Oak hallway floor running through a closet door casing, frame 1 of 3, full hallway view, Ecowoods site work, Toronto.',
        'The hallway.', 'The room'),
      frame('oak-hallway-closet-transition', '02',
        'Oak floor transition at a closet threshold, frame 2 of 3, camera approaching the casing where stone stops and wood continues, Ecowoods site work, Toronto.',
        'The threshold.', 'The approach'),
      frame('oak-hallway-closet-transition', '03',
        'Oak floor transition at a closet threshold, frame 3 of 3, macro of the material line at the casing, Ecowoods site work, Toronto.',
        'The line.', 'The joint'),
    ],
    provenance: PROVENANCE,
  },
  {
    slug: 'herringbone-dormer-room',
    kicker: 'Herringbone oak',
    headline: 'The V points at the dormer.',
    lede: 'Herringbone laid so the pattern and the window agree.',
    body: 'Attic rooms show every drift in the layout. The close frame is the point.',
    routes: ['/hardwood-flooring-toronto', '/library', '/projects/herringbone-dormer-room'],
    kind: 'residential',
    frames: [
      frame('herringbone-dormer-room', '01',
        'Herringbone oak floor in a dormer room aimed at the window, frame 1 of 3, standing room view, Ecowoods site work, Toronto.',
        'The dormer.', 'The room'),
      frame('herringbone-dormer-room', '02',
        'Herringbone oak floor, frame 2 of 3, camera following the pattern toward the dormer window, Ecowoods site work, Toronto.',
        'Pointed at the window.', 'The approach'),
      frame('herringbone-dormer-room', '03',
        'Herringbone oak floor, frame 3 of 3, macro of the herringbone V joint, Ecowoods site work, Toronto.',
        'The V.', 'The joint'),
    ],
    provenance: PROVENANCE,
  },
  {
    slug: 'loft-kitchen-light-strip',
    kicker: 'Character-grade strip · kitchen',
    headline: 'The knot stays.',
    lede: 'Light strip oak beside a granite island and brick. Character is not a defect when it is specified.',
    body:
      'Kitchens punish floors. Species, grade, and finish have to be chosen for that, then photographed without hiding the grain.',
    routes: ['/hardwood-flooring-toronto', '/library', '/projects/loft-kitchen-light-strip'],
    kind: 'residential',
    frames: [
      frame('loft-kitchen-light-strip', '01',
        'Character-grade light strip oak floor in a brick loft kitchen beside a granite island, frame 1 of 3, standing room view, Ecowoods site work, Toronto.',
        'The kitchen.', 'The room'),
      frame('loft-kitchen-light-strip', '02',
        'Light strip oak floor, frame 2 of 3, camera approaching the boards beside the kitchen island, Ecowoods site work, Toronto.',
        'Beside the island.', 'The approach'),
      frame('loft-kitchen-light-strip', '03',
        'Light strip oak floor, frame 3 of 3, macro of a natural knot in the grain, Ecowoods site work, Toronto.',
        'The knot.', 'The grain'),
    ],
    provenance: PROVENANCE,
  },
  {
    slug: 'rickis-store-maple-strip',
    kicker: 'Retail maple',
    headline: 'A store floor is a traffic surface first.',
    lede: 'Light maple strip under retail lighting, running to the counter. Quiet enough that the clothes can be loud.',
    body:
      'Commercial work is judged at 9 p.m. after a Saturday. The close frame is the seam that has to survive that.',
    routes: ['/commercial', '/library', '/projects/rickis-store-maple-strip'],
    kind: 'commercial',
    frames: [
      frame('rickis-store-maple-strip', '01',
        'Light maple strip floor in a retail store running toward the counter, frame 1 of 3, full shop view, Ecowoods site work, Toronto.',
        'The shop.', 'The room'),
      frame('rickis-store-maple-strip', '02',
        'Light maple strip retail floor, frame 2 of 3, camera down the aisle toward the counter, Ecowoods site work, Toronto.',
        'The aisle.', 'The approach'),
      frame('rickis-store-maple-strip', '03',
        'Light maple strip retail floor, frame 3 of 3, macro of a board seam built to survive foot traffic, Ecowoods site work, Toronto.',
        'The traffic surface.', 'The seam'),
    ],
    provenance: PROVENANCE,
  },
  {
    slug: 'rickis-storefront',
    kicker: 'Mall threshold',
    headline: 'Hardwood begins where the mall tile ends.',
    lede: 'One line. Two contracts. The store is finished before it is merchandised.',
    body: 'The threshold is the whole commercial argument: we stop their floor and start ours without a trip edge.',
    routes: ['/commercial', '/library', '/projects/rickis-storefront'],
    kind: 'commercial',
    frames: [
      frame('rickis-storefront', '01',
        'Hardwood retail floor beginning at a mall storefront threshold, frame 1 of 3, full storefront view, Ecowoods site work, Toronto.',
        'The portal.', 'The room'),
      frame('rickis-storefront', '02',
        'Hardwood retail floor at a mall threshold, frame 2 of 3, camera crossing the line from mall tile to hardwood, Ecowoods site work, Toronto.',
        'Crossing the line.', 'The approach'),
      frame('rickis-storefront', '03',
        'Hardwood retail floor at a mall threshold, frame 3 of 3, macro of the cut where mall tile meets hardwood with no trip edge, Ecowoods site work, Toronto.',
        'The cut.', 'The threshold'),
    ],
    provenance: PROVENANCE,
  },
  {
    slug: 'geometric-inlay-borders',
    kicker: 'Inlay joint',
    headline: 'Four strips. One crossing.',
    lede: 'This is the photograph you send a client who asks what "tight" means.',
    body: 'No room. No furniture. Only the X.',
    routes: ['/library', '/hardwood-flooring-toronto', '/projects/geometric-inlay-borders'],
    kind: 'detail',
    frames: [
      frame('geometric-inlay-borders', '01',
        'Geometric inlay border panel in an oak floor, frame 1 of 3, full panel view, Ecowoods site work, Toronto.',
        'The panel.', 'The room'),
      frame('geometric-inlay-borders', '02',
        'Geometric inlay border, frame 2 of 3, camera approaching where four border strips cross, Ecowoods site work, Toronto.',
        'The crossing.', 'The approach'),
      frame('geometric-inlay-borders', '03',
        'Geometric inlay border, frame 3 of 3, macro of the X where four strips meet, Ecowoods site work, Toronto.',
        'The X.', 'The joint'),
    ],
    provenance: PROVENANCE,
  },
  {
    slug: 'herringbone-oak-border',
    kicker: 'Herringbone at the border',
    headline: 'A block against a dark line.',
    lede: 'Pattern dies or lives at the border. Here it lives.',
    body: 'Frame three is pores. That is the finish talking.',
    routes: ['/library', '/hardwood-flooring-toronto', '/projects/herringbone-oak-border'],
    kind: 'detail',
    frames: [
      frame('herringbone-oak-border', '01',
        'Herringbone oak field meeting a dark border, frame 1 of 3, full field view, Ecowoods site work, Toronto.',
        'The field.', 'The room'),
      frame('herringbone-oak-border', '02',
        'Herringbone oak border, frame 2 of 3, camera approaching one block against the dark border line, Ecowoods site work, Toronto.',
        'Block and line.', 'The approach'),
      frame('herringbone-oak-border', '03',
        'Herringbone oak border, frame 3 of 3, macro of open wood pore texture under the finish, Ecowoods site work, Toronto.',
        'The pore.', 'The finish'),
    ],
    provenance: PROVENANCE,
  },
  {
    slug: 'paneled-oval-room-herringbone',
    kicker: 'Herringbone in a paneled oval',
    headline: 'The floor has to be as serious as the walls.',
    lede:
      'Dark herringbone under a gold ceiling and a bow of French doors. The woodwork was already there. The floor had to arrive at the same register.',
    body:
      'Grand rooms fail when the floor is a different decade than the paneling. These three frames stay with the oak.',
    routes: ['/projects/paneled-oval-room-herringbone', '/library'],
    kind: 'grand',
    frames: [
      frame('paneled-oval-room-herringbone', '01',
        'Dark herringbone oak floor in a paneled oval room under a gold ceiling, frame 1 of 3, full oval room view, Ecowoods site work, Toronto.',
        'The oval.', 'The room'),
      frame('paneled-oval-room-herringbone', '02',
        'Dark herringbone oak floor in a paneled oval room, frame 2 of 3, camera crossing the hall toward the bow of French doors, Ecowoods site work, Toronto.',
        'Across the hall.', 'The approach'),
      frame('paneled-oval-room-herringbone', '03',
        'Dark herringbone oak floor in a paneled oval room, frame 3 of 3, macro of the herringbone weave reflecting the gold ceiling, Ecowoods site work, Toronto.',
        'The reverse.', 'The weave'),
    ],
    provenance: PROVENANCE,
  },
];

export const getTrilogy = (slug: string): Trilogy | undefined => TRILOGIES.find((t) => t.slug === slug);
export const getTrilogies = (kind?: TrilogyKind): Trilogy[] =>
  kind ? TRILOGIES.filter((t) => t.kind === kind) : TRILOGIES;
