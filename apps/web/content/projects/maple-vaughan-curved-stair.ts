/**
 * content/projects/maple-vaughan-curved-stair.ts — the photographic record of
 * one job, in two chapters.
 *
 * WHY THIS IS A PROJECT AND NOT A CASE STUDY
 *
 * lib/content/case-study-types.ts requires square footage, substrate type,
 * species, initial and final moisture readings, subfloor moisture, install
 * days and cure days. Not one of those exists for this job — what exists is a
 * set of photographs. Filling a measurements schema with numbers nobody
 * measured is precisely the failure this repository already cleaned up once,
 * and the type's own comment records the last one (F-176, five case studies
 * carrying private street addresses).
 *
 * So this is its own thing: a photo record, honest about being a photo record,
 * asserting only what a person can see in the frames.
 *
 * THREE THINGS THIS FILE DELIBERATELY DOES NOT SAY
 *
 * 1. NO STREET ADDRESS. The campaign material carries a civic address. Every
 *    published case study on this site was stripped of exactly that in August,
 *    for the reason the type comment gives: if the project is real, a client's
 *    home address goes up without evidence they agreed; and the neighbourhood
 *    was doing all of the local-search work anyway. "Maple, Vaughan" is a
 *    query. A house number is not.
 *
 * 2. NO SPECIES. The archive names call the treads oak; the campaign folder
 *    is called "Maple", which is the NEIGHBOURHOOD, not the wood. Publishing
 *    a species is a business fact about a real job, and content/claims.ts is
 *    where business facts get registered before they ship. Until the estimator
 *    confirms it, the copy describes what the photographs show — bare sanded
 *    treads, then stained ones — and names no wood.
 *
 * 3. NO PRICE, NO AREA, NO DURATION. Same rule.
 *
 * WHAT IT DOES SAY is visible in the frames: the same curved stair and the
 * same well, sanded to bare in chapter one and stained in chapter two, in an
 * occupied finished house.
 */

export type ProjectStill = {
  /** Stable id. Used in the API and in URLs; never renumber in place. */
  id: string;
  chapter: 1 | 2;
  /** Story order. 00 opens the chapter, 99 closes it. */
  order: number;
  role: 'card' | 'interior';
  /** Describes the room. Never "an image of". */
  alt: string;
  src: string;
  width: number;
  height: number;
  /** A camera pointed at a real room. lib/images.ts draws this distinction. */
  kind: 'photograph';
  /**
   * Where the Ken Burns move should originate, as a CSS transform-origin.
   * Chosen per plate: the stair well pulls from below, an overhead from the
   * centre, a landing from the rail line.
   */
  origin: string;
};

export type ProjectFilm = {
  id: string;
  chapter: 1 | 2;
  aspect: '16:9';
  src: string;
  /** Id of the still used as the poster — the LCP element, never the video. */
  posterStillId: string;
  title: string;
  width: number;
  height: number;
};

export type ProjectPair = {
  id: string;
  beforeStillId: string;
  afterStillId: string;
  /** What is the same in both frames. This is the whole point of the pair. */
  anchor: string;
};

export type Project = {
  slug: string;
  title: string;
  /** Neighbourhood resolution and no finer. */
  location: { neighbourhood: string; city: string; province: string };
  summary: string;
  /** What the record does NOT establish, said out loud. */
  limits: string[];
  chapters: { id: 1 | 2; label: string; note: string }[];
  stills: ProjectStill[];
  films: ProjectFilm[];
  pairs: ProjectPair[];
};

const P = '/proof/maple-vaughan-curved-stair';
const F = '/films/maple-vaughan-curved-stair';

const still = (
  chapter: 1 | 2,
  order: number,
  file: string,
  alt: string,
  origin = 'center',
  role: 'card' | 'interior' = 'interior',
): ProjectStill => ({
  id: `ch${chapter}-${String(order).padStart(2, '0')}`,
  chapter,
  order,
  role,
  alt,
  src: `${P}/ch${chapter}/${String(order).padStart(2, '0')}_${file}.webp`,
  width: 1920,
  height: 1080,
  kind: 'photograph',
  origin,
});

export const MAPLE_VAUGHAN_CURVED_STAIR: Project = {
  slug: 'maple-vaughan-curved-stair',
  title: 'A curved stair in Maple, Vaughan — bare, then stained',
  location: { neighbourhood: 'Maple', city: 'Vaughan', province: 'ON' },
  summary:
    'The same curved stair and the same open well, photographed twice: once with the treads and floors sanded to bare wood, and once after the stain and finish went down. Same house, same light, same angles wherever the camera allowed it.',
  limits: [
    'This is a photographic record, not an engineering case study. It publishes no square footage, no moisture readings, no schedule and no price, because none were recorded with it.',
    'The wood species is not stated. The archive names describe the treads as oak; that is a note from the edit, not a measurement, and a species is a business fact this site registers before it publishes.',
    'The location is given at neighbourhood resolution. The campaign material carries a civic address and it is deliberately not reproduced here.',
  ],
  chapters: [
    {
      id: 1,
      label: 'Sanded to bare',
      note: 'Treads, landing and floors taken back to raw wood. Black iron spindles and the painted stringer are already in place, so every pass is being cut around finished work in an occupied house.',
    },
    {
      id: 2,
      label: 'Stained and finished',
      note: 'The same stair after colour. The well, the chandelier and the marble below are the fixed points — everything that changed is the wood.',
    },
  ],
  stills: [
    still(1, 0, 'chapter_open_ecowoods', 'Chapter card: “Sanded to bare”, set in the Ecowoods wordmark over a dark ground.', 'center', 'card'),
    still(1, 1, 'foyer_entry_light_oak_and_curved_stair', 'Entry hall looking at the foot of the curved stair. Freshly sanded treads and a pale unfinished floor run through to a bright room beyond; the handrail is bare wood, the spindles matte black.', '50% 70%'),
    still(1, 2, 'front_elevation_light_oak_curved_stair', 'The stair seen square on from the hall, the curve of the stringer sweeping up to the landing above bare, light-toned treads.', '50% 60%'),
    still(1, 3, 'through_columns_to_stair_well', 'Framed between two painted columns, the open stair well with unfinished treads rising past the balustrade.', 'center'),
    still(1, 4, 'side_angle_light_oak_treads_black_spindles', 'Side view along the flight: pale sanded treads against black iron spindles, the painted riser faces clean.', '40% 60%'),
    still(1, 5, 'overhead_well_light_treads_marble_below', 'Looking down the open well from the upper landing. Light bare treads spiral around the void, with the tiled foyer floor visible at the bottom.', 'center'),
    still(1, 6, 'overhead_unfinished_treads_and_rail', 'Overhead detail of unfinished treads meeting the curved handrail, the grain open and colourless after sanding.', 'center'),
    still(1, 7, 'upstairs_landing_arched_windows_light_oak', 'Upper landing with arched windows, floorboards sanded pale and continuous across the opening.', '50% 65%'),
    still(1, 8, 'landing_geometric_chandelier_light_floors', 'The landing beneath a geometric chandelier, bare floor running to the rail.', '50% 40%'),
    still(1, 9, 'dining_alcove_light_oak_blue_walls', 'Dining alcove off the hall, blue-grey walls above an unfinished floor.', 'center'),
    still(1, 10, 'living_room_white_mantel_through_arch', 'Through an arch into the living room, white mantel ahead, the sanded floor continuing under the opening.', 'center'),
    still(1, 99, 'chapter_close_ecowoods', 'Closing card for chapter one.', 'center', 'card'),

    still(2, 0, 'chapter_open_ecowoods', 'Chapter card: “Stained and finished”.', 'center', 'card'),
    still(2, 1, 'landing_after_dark_floors_curved_rail', 'The upper landing after staining. The floor now reads deep and warm, the curved handrail matching, the black spindles unchanged.', '50% 65%'),
    still(2, 2, 'landing_dark_hardwood_and_art', 'Landing with framed art on the wall above a stained floor, the colour even from board to board.', '50% 55%'),
    still(2, 3, 'looking_down_dark_stair_into_living', 'Looking down the finished flight toward the living space, treads and rail now a matched tone.', '50% 70%'),
    still(2, 4, 'overhead_dark_spiral_to_marble_foyer', 'The open well from directly above after finishing: the stair spirals in stained wood around the void, with the pale tiled foyer at the bottom.', 'center'),
    still(2, 5, 'overhead_treads_meeting_marble', 'Overhead of the lowest treads meeting the tiled foyer floor, the transition line clean.', '50% 60%'),
    still(2, 6, 'base_newel_from_marble_foyer', 'The base newel photographed from the foyer, finished wood against tile.', '50% 60%'),
    still(2, 7, 'handrail_spindles_dark_field', 'Handrail and spindles running across a field of finished floor.', 'center'),
    still(2, 8, 'closeup_newel_treads_spindles', 'Close detail of the newel, the tread nosings and the iron spindles after finishing.', 'center'),
    still(2, 99, 'chapter_close_ecowoods', 'Closing card for chapter two.', 'center', 'card'),
  ],
  films: [
    {
      id: 'ch1-film',
      chapter: 1,
      aspect: '16:9',
      src: `${F}/01_before_sanded_to_bare.mp4`,
      posterStillId: 'ch1-01',
      title: 'Chapter one — sanded to bare',
      width: 1920,
      height: 1080,
    },
    {
      id: 'ch2-film',
      chapter: 2,
      aspect: '16:9',
      src: `${F}/02_after_stained_and_finished.mp4`,
      posterStillId: 'ch2-04',
      title: 'Chapter two — stained and finished',
      width: 1920,
      height: 1080,
    },
  ],
  /**
   * PAIRS ARE NOT A WIPE. The two chapters were not shot on a locked tripod,
   * so a slider that drags one frame across the other would fake a
   * correspondence the camera never had. These are two-up, labelled, with the
   * fixed point named — which is more convincing anyway, because the reader
   * can check it.
   */
  pairs: [
    { id: 'well', beforeStillId: 'ch1-05', afterStillId: 'ch2-04', anchor: 'the open well, shot from the upper landing' },
    { id: 'treads', beforeStillId: 'ch1-06', afterStillId: 'ch2-05', anchor: 'the treads where they meet the tiled foyer' },
    { id: 'landing', beforeStillId: 'ch1-08', afterStillId: 'ch2-01', anchor: 'the landing under the geometric chandelier' },
  ],
};
