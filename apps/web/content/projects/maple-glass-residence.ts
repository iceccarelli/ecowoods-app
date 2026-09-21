/**
 * content/projects/maple-glass-residence.ts — a hard-maple field and
 * matching open-riser stair, photographed as one continuous walkthrough.
 *
 * WHY THIS IS A PROJECT AND NOT A CASE STUDY
 *
 * Same reasoning as maple-vaughan-curved-stair.ts and
 * stone-cottage-strip-refinish.ts: lib/content/case-study-types.ts requires
 * square footage, substrate, moisture readings and a schedule. The source
 * pack states an approximate area (~1,800 sq ft) and a duration (one week)
 * as descriptive context for the crew, not a measured takeoff — neither
 * becomes a structured field here.
 *
 * ONE CHAPTER, NOT TWO. Unlike the other two records, this job was not
 * photographed as a before/after — it is a single visit, walked room to
 * room after the floor and stair were finished. `chapters` therefore holds
 * one entry and `pairs` is empty; ProjectPage's own chapter-two and
 * before/after sections render only when the data for them exists.
 *
 * THREE THINGS THIS FILE DELIBERATELY DOES NOT SAY
 *
 * 1. NO STREET ADDRESS. The source pack carries none at all — location is
 *    given at city/GTA resolution, the company's own published market.
 *
 * 2. NO PRICE, NO MOISTURE READING, NO SCHEDULE. The brief describes one
 *    week on site and an approximate 1,800 sq ft field; both are context
 *    for the crew, not a measurement this page publishes.
 *
 * 3. GLASS, WALNUT AND STONE ARE OTHER TRADES. They are in almost every
 *    frame — the guard rails, the headboard wall, the reducer threshold —
 *    and the copy never claims Ecowoods installed them.
 *
 * SPECIES: Hard Maple is already a registered site species (floor-studio,
 * the species-comparison guide, glossary) — unlike the untitled boards in
 * the other two records, naming it here is not asserting a fresh business
 * fact, it is describing what floor-studio already publishes. No Janka
 * number and no dollar figure are invented alongside it.
 */
import type { Project, ProjectStill, ProjectDetail, ProjectFilm } from './maple-vaughan-curved-stair';

const P = '/proof/maple-glass-residence';
const F = '/films/maple-glass-residence';

const still = (
  chapter: 1,
  order: number,
  file: string,
  alt: string,
  origin = 'center',
): ProjectStill => ({
  id: `ch${chapter}-${String(order).padStart(2, '0')}`,
  chapter,
  order,
  role: 'interior',
  alt,
  src: `${P}/ch${chapter}/${String(order).padStart(2, '0')}_${file}.webp`,
  width: 1920,
  height: 1080,
  kind: 'photograph',
  origin,
});

const detail = (order: number, file: string, alt: string): ProjectDetail => ({
  id: `detail-${String(order).padStart(2, '0')}`,
  src: `${P}/details/${String(order).padStart(2, '0')}-${file}.webp`,
  width: 1920,
  height: 1080,
  alt,
  pairsWithStillId: `ch1-${String(order).padStart(2, '0')}`,
});

const FILM: ProjectFilm = {
  id: 'ch1-film',
  chapter: 1,
  aspect: '16:9',
  src: `${F}/01-residence-walkthrough.mp4`,
  posterStillId: 'ch1-15',
  title: 'The rooms as walked',
  width: 1920,
  height: 1080,
};

export const MAPLE_GLASS_RESIDENCE: Project = {
  slug: 'maple-glass-residence',
  title: 'A hard-maple residence, field and stair in one walkthrough',
  location: { neighbourhood: 'GTA', city: 'Toronto', province: 'ON' },
  summary:
    'A continuous select hard-maple floor through a primary suite, dressing rooms, an open-riser glass stair and a living room, photographed in one walkthrough after the sand and finish were done. Same species, same colour and the same satin sheen from the field to the treads.',
  limits: [
    'This is a photographic record of one visit, not an engineering case study. It publishes no square footage, no moisture readings, no schedule and no price, because this page does not treat the brief’s approximate figures as measurements.',
    'The photographs are graded iPhone-class job stills, colour-matched to a single cream/satin maple and branded with the Ecowoods mark — not a full-frame architectural reshoot.',
    'The location is given at city resolution. The source material carries no street address and none is used here.',
    'The frameless glass guards, the walnut millwork and the stone tile visible in almost every frame are other trades’ work. This page describes the hard-maple floor and stair Ecowoods installed, not the glass, the walnut or the stone.',
  ],
  chapters: [
    {
      id: 1,
      label: 'The rooms as walked',
      note: 'One continuous run of select hard maple, satin finish, carried from the primary suite through the dressing rooms, down the open-riser stair and into the living room below.',
    },
  ],
  stills: [
    still(1, 1, 'void-looking-down-dual-flight', 'Select hard maple stair treads and landing seen from the upper void, framed by frameless glass guardrails.', '50% 60%'),
    still(1, 2, 'void-open-riser-glass', 'Open-riser hard maple treads with black steel stringer seen through tempered glass.', '50% 60%'),
    still(1, 3, 'void-centerline-alignment', 'Looking down a three-level maple stair well with glass guards and matching landings.', 'center'),
    still(1, 4, 'primary-suite-plank-field', 'Wide hard maple planks running the length of a primary bedroom toward a floor-to-ceiling window.', '50% 70%'),
    still(1, 5, 'upper-landing-glass-guard', 'Upper-level maple landing with frameless glass guard looking into the stair void.', '50% 55%'),
    still(1, 6, 'upper-floor-stair-mouth', 'Maple floor opening to a glass-lined stair with matching open-riser treads.', '50% 60%'),
    still(1, 7, 'upper-floor-glass-return', 'Frameless glass return and maple nosing at the upper-floor stair opening.', 'center'),
    still(1, 8, 'underside-treads-glass', 'Looking up at hard maple open-riser treads through glass, showing fastener rhythm and grain match.', 'center'),
    still(1, 9, 'suite-to-void-enfilade', 'Maple floor running from the primary suite through a door opening toward the glass stair.', 'center'),
    still(1, 10, 'suite-threshold-to-hall', 'Light hard maple flowing from the bedroom through a white door into the upper hallway.', 'center'),
    still(1, 11, 'glass-wardrobe-run', 'Long dressing corridor with glass wardrobe doors over a continuous hard maple floor.', 'center'),
    still(1, 12, 'dressing-gallery-axis', 'Axis view of a dressing room with maple floor, tall millwork and a window of light at the end.', 'center'),
    still(1, 13, 'maple-grain-close-field', 'Close view of select-grade hard maple planks with natural cathedral grain and satin sheen.', 'center'),
    still(1, 14, 'primary-toward-bath', 'Maple bedroom floor leading past a platform bed toward an ensuite and hall.', '50% 65%'),
    still(1, 15, 'primary-window-wash', 'Sunlight across hard maple planks in a primary bedroom with a dark walnut headboard wall.', '50% 65%'),
    still(1, 16, 'primary-centered-bed-wall', 'Centered view of a walnut headboard wall standing on a field of select hard maple.', 'center'),
    still(1, 17, 'primary-entry-diagonal', 'Diagonal view of maple flooring in the primary bedroom from the doorway.', '40% 60%'),
    still(1, 18, 'living-media-wall-field', 'Open living room with hard maple planks running to a walnut media wall and a stone-tile threshold.', '50% 70%'),
    still(1, 19, 'living-ceiling-light-wash', 'Maple living-room floor under linear ceiling lights with walnut media millwork.', 'center'),
    still(1, 20, 'hall-stone-to-maple-reducer', 'Flush maple-to-stone threshold in a hall, with maple continuing toward the stair and kitchen.', '50% 70%'),
  ],
  films: [FILM],
  pairs: [],
  /**
   * Close plates, one delight per frame, companions to the wide stills
   * above. `pairsWithStillId` names the wide still each detail zooms in on
   * — the copy pack's own manifest confirms detail NN and wide NN share the
   * same source photograph, so the pairing is a straight number match.
   */
  details: [
    detail(1, 'tread-to-landing-grain-match', 'Treads and landing cut from the same maple run, colour and grain reading as one plane at the nosing.'),
    detail(2, 'open-riser-profile-black-stringer', 'The open side of a maple tread against its black steel stringer, the grain running the walking line.'),
    detail(3, 'landing-field-joint-stagger', 'Staggered end joints on the stair landing, laid as floor rather than a leftover offcut.'),
    detail(4, 'satin-sheen-window-wash', 'Natural satin finish holding an even cream tone in direct window light.'),
    detail(5, 'landing-edge-at-glass-void', 'A straight maple edge carried to the glass line where the upper floor breaks into the stair well.'),
    detail(6, 'first-tread-floor-plane', 'The first open-riser tread matching the upper floor in colour, thickness and sheen.'),
    detail(7, 'glass-corner-maple-return', 'Maple flooring returning clean under a glass corner clamp, the other trade’s hardware visible.'),
    detail(8, 'underside-fastener-rhythm', 'The finished underside of an open-riser flight, fasteners set on a single visible line.'),
    detail(9, 'doorway-run-unbroken', 'One species and one plank direction carried unbroken through a doorway threshold.'),
    detail(10, 'plank-direction-through-hall', 'Board direction held along the long axis of the house through an upper hallway.'),
    detail(11, 'narrow-run-joint-discipline', 'Full-length boards kept in a narrow corridor run, joints staggered rather than clustered.'),
    detail(12, 'long-axis-end-match', 'End joints stepped along a single long run from door to far wall.'),
    detail(13, 'select-maple-cathedral-grain', 'Select-grade hard maple in satin finish, showing the cathedral grain used through the house.'),
    detail(14, 'field-beside-platform-bed', 'The maple field kept on layout around an unfinished platform bed base.'),
    detail(15, 'light-break-across-boards', 'Window light breaking softly across the boards, the satin finish reading as a tonal step, not a glare.'),
    detail(16, 'staggered-ends-in-the-suite', 'Stepped end joints in the primary suite field, avoiding a repeating ladder pattern.'),
    detail(17, 'colour-hold-across-the-room', 'Sorted maple boards holding one cream tone from the doorway across the room.'),
    detail(18, 'stone-to-maple-flush-reducer', 'A flush reducer where hard maple meets stone tile on a single plane, with no ramp or lip.'),
    detail(19, 'board-run-to-media-wall', 'Planks aimed at a walnut media wall, the floor stopping clean at its base.'),
    detail(20, 'hall-reducer-and-vent-cut', 'The same flush stone-to-maple reducer paired with a floor register cut that follows the board line.'),
  ],
};
