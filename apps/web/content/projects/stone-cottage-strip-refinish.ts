/**
 * content/projects/stone-cottage-strip-refinish.ts — a whole-home strip
 * hardwood refinish, in two chapters plus a set of close plates.
 *
 * WHY THIS IS A PROJECT AND NOT A CASE STUDY
 *
 * Same reasoning as maple-vaughan-curved-stair.ts: lib/content/case-study-types.ts
 * requires square footage, substrate, species, moisture readings and a
 * schedule. None of those were recorded with this set — what exists is a
 * set of photographs, twice: worn and dusty, then sanded and finished.
 *
 * FOUR THINGS THIS FILE DELIBERATELY DOES NOT SAY
 *
 * 1. NO HOUSE NUMBER. The exterior frame shows a real stone cottage with an
 *    oval address plaque beside the door — the plaque can appear in a photo,
 *    but the number is never written into the slug, title, schema or copy.
 *
 * 2. NO SPECIES. The source pack's own captions call the boards oak; that is
 *    a note from the shoot, not a registered claim, and content/claims.ts is
 *    where a species goes public before it ships. This file says "strip
 *    hardwood" and nothing more specific.
 *
 * 3. NO PRICE, NO AREA, NO DURATION. Same rule as every other Project here.
 *
 * 4. THESE ARE EDITORIAL RECONSTRUCTIONS. The source pack says so directly:
 *    the frames are leveled, perspective-corrected and lighting-refined
 *    versions of the original job-site photographs — real rooms, not a
 *    locked-tripod measurement record. `limits` says this out loud rather
 *    than letting a reader assume a slider-grade before/after.
 *
 * The two chapters were shot as separate visits with a handheld camera, so
 * pairs here are two-up (BeforeAfterPair), never a wipe — the same rule
 * maple-vaughan-curved-stair.ts already follows and explains in that file's
 * own pairs comment.
 */
import type { Project, ProjectStill, ProjectDetail } from './maple-vaughan-curved-stair';

const P = '/proof/stone-cottage-strip-refinish';

const detail = (
  file: string,
  width: number,
  height: number,
  alt: string,
  pairsWithStillId?: string,
): ProjectDetail => ({
  id: file,
  src: `${P}/details/${file}.webp`,
  width,
  height,
  alt,
  pairsWithStillId,
});

/**
 * Width/height are the measured dimensions of each WebP, read off
 * MANIFEST.json — these frames were shot in a mix of portrait and landscape,
 * so unlike the maple-vaughan set there is no single frame size to assume.
 */
const still = (
  chapter: 1 | 2,
  order: number,
  file: string,
  width: number,
  height: number,
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
  width,
  height,
  kind: 'photograph',
  origin,
});

export const STONE_COTTAGE_STRIP_REFINISH: Project = {
  slug: 'stone-cottage-strip-refinish',
  title: 'A stone cottage, strip hardwood refinished floor by floor',
  location: { neighbourhood: 'Toronto', city: 'Toronto', province: 'ON' },
  summary:
    'A whole-home strip hardwood refinish photographed twice: once with the finish gone grey and the traffic paths showing, and once after the floors were sanded to bare wood and refinished, room by room, while the kitchen was still in boxes and the stair was still mid-strip.',
  limits: [
    'These photographs are editorial reconstructions of the original job-site frames — leveled, perspective-corrected and lighting-refined. They are not a locked-tripod measurement record, and they publish no square footage, no moisture readings, no schedule and no price, because none were recorded with them.',
    'The wood species is not stated. The source material names it in passing; that is a note from the shoot, not a measurement, and a species is a business fact this site registers before it publishes.',
    'The house is real and older than the finish; the location is given at the city level, and the address plaque visible in one frame is never written into this page or its slug.',
  ],
  chapters: [
    {
      id: 1,
      label: 'Worn and dusty',
      note: 'The hallway, the main rooms and the stair before the sanders — a tired, hazed finish, an old repair still visible in the hall, and paint failing on the stair treads.',
    },
    {
      id: 2,
      label: 'Sanded and finished',
      note: 'The same rooms after a full sand and refinish. The kitchen cabinets arrive on a floor that is already done; the stair is still mid-strip while the hall beside it is finished.',
    },
  ],
  stills: [
    still(1, 0, 'chapter_open_ecowoods', 1920, 1080, 'Chapter card: "Worn and dusty", set in the Ecowoods wordmark over a dark ground.', 'center', 'card'),
    still(1, 1, 'sunlit_yellow_hallway', 1200, 1600, 'A sunlit yellow hallway before refinishing, the floor holding an old oval repair patch and years of traffic wear.', '50% 65%'),
    still(1, 2, 'sage_room_worn', 1600, 1200, 'A sage-walled room with a worn, hazed floor, scratches and traffic paths visible through the old finish.', 'center'),
    still(1, 3, 'sage_room_through_door', 1200, 1600, 'The same sage room seen through an open door, the tired floor continuing past the threshold.', 'center'),
    still(1, 4, 'kitchen_dusty', 1200, 1600, 'A dusty kitchen floor before the cabinets arrive, the old finish worn through in the high-traffic path.', 'center'),
    still(1, 5, 'kitchen_cabinets_raw_floor', 1200, 1600, 'Cabinet boxes already set on an unfinished kitchen floor, ahead of the refinish.', 'center'),
    still(1, 6, 'stair_hall_dust', 1200, 1600, 'The stair and adjoining hall before work begins, dust and wear visible on both.', '50% 60%'),
    still(1, 7, 'stair_run_peeling_treads', 1200, 1600, 'A stair run with paint failing in layers on the risers and treads.', '50% 70%'),
    still(1, 8, 'stair_looking_down', 1200, 1600, 'Looking down a worn stair run, traffic compressed into the grain of each tread.', 'center'),
    still(1, 99, 'chapter_close_ecowoods', 1920, 1080, 'Closing card for chapter one.', 'center', 'card'),

    still(2, 0, 'chapter_open_ecowoods', 1920, 1080, 'Chapter card: "Sanded and finished".', 'center', 'card'),
    still(2, 1, 'exterior_stone_cottage_red_door', 1600, 1200, 'A stone cottage exterior with a red door — the heritage envelope the refinish sits inside.', 'center'),
    still(2, 2, 'after_sunlit_yellow_hallway', 1200, 1600, 'The same sunlit hallway after refinishing, the floor now reading as one even surface end to end.', '50% 65%'),
    still(2, 3, 'after_sage_room_french_door_sheen', 1600, 1200, 'The sage room after finishing, a french door reflected cleanly in the sheen of the floor.', 'center'),
    still(2, 4, 'after_sage_room_window_light', 1600, 1200, 'The same room in different window light, the finish holding an even tone across the boards.', 'center'),
    still(2, 5, 'after_sage_room_open_plan', 1600, 1200, 'The sage room emptied out after finishing, continuous grain running the length of the open-plan space.', 'center'),
    still(2, 6, 'after_window_alcove_closets', 1600, 1200, 'A window alcove with original closets and a newly finished floor underneath.', 'center'),
    still(2, 7, 'after_grey_room_chair_rail', 1600, 1200, 'A grey-walled room with a chair rail and a long baseboard heater, the floor finished around both.', 'center'),
    still(2, 8, 'after_louvered_closets_grey_room', 1600, 1200, 'Louvered closets in a grey room, the finished floor running continuously beneath the storage wall.', 'center'),
    still(2, 9, 'after_enfilade_through_doorway', 1200, 1600, 'One finished floor seen through a doorway into a second room, the surface reading as a single line.', 'center'),
    still(2, 10, 'after_kitchen_threshold_new', 1200, 1600, 'A kitchen threshold with the floor already finished while the kitchen itself is still a shell.', 'center'),
    still(2, 11, 'process_kitchen_cabinets_on_finished', 1200, 1600, 'Raw cabinet boxes set on a floor that was finished before the kitchen trades arrived.', 'center'),
    still(2, 12, 'stairs_treads_stripped_floor_finished', 1200, 1600, 'A stair mid-strip beside a hallway that is already finished — two paces of the same job in one house.', '50% 70%'),
    still(2, 99, 'chapter_close_ecowoods', 1920, 1080, 'Closing card for chapter two.', 'center', 'card'),
  ],
  films: [],
  pairs: [
    { id: 'hallway', beforeStillId: 'ch1-01', afterStillId: 'ch2-02', anchor: 'the sunlit hallway, same window, same length of floor' },
    { id: 'sage', beforeStillId: 'ch1-02', afterStillId: 'ch2-05', anchor: 'the sage-walled room, open and empty in both frames' },
    { id: 'kitchen', beforeStillId: 'ch1-04', afterStillId: 'ch2-11', anchor: 'the kitchen floor, dusty before the cabinets, finished once they are set' },
    { id: 'stair', beforeStillId: 'ch1-07', afterStillId: 'ch2-12', anchor: 'the stair treads, paint failing before, stripped once the sander reaches them' },
  ],
  /**
   * Close plates, one delight per frame — companions to the wide chapter
   * stills above, not a replacement for them. `pairsWithStillId` names the
   * wide still each detail zooms in on, per the source pack's own
   * wide-to-detail table, so a consumer can link a plate back to its room.
   */
  details: [
    detail('05-01-detail-stone-arch-red-door', 1264, 1568, 'A fieldstone arch and painted door — the heritage exterior the refinish sits inside.', 'ch2-01'),
    detail('06-01-detail-sunshaft-on-sheen', 1200, 1600, 'Daylight raking low across a finished floor, the sheen holding an even reflection.', 'ch2-02'),
    detail('06-02-detail-door-grid-in-sheen', 1600, 1200, 'A french door reflected in the floor finish, the mullions drawn clean by the sheen.', 'ch2-03'),
    detail('06-03-detail-strip-end-joint-grain', 1600, 1200, 'A close view of an end-match joint, the grain open and the colour even after sanding.', 'ch2-05'),
    detail('06-04-detail-baseboard-reveal-line', 1600, 1200, 'The finished floor meeting an existing baseboard in a clean, even line.', 'ch2-05'),
    detail('06-05-detail-floor-through-doorway', 1200, 1600, 'Boards continuing through a doorway into a second room, unbroken.', 'ch2-09'),
    detail('06-06-detail-window-bars-on-boards', 1600, 1200, 'Window mullions laid as light across the finished boards.', 'ch2-06'),
    detail('06-07-detail-floor-at-louvered-closets', 1600, 1200, 'The finished floor running continuously under a wall of louvered closets.', 'ch2-08'),
    detail('06-08-detail-floor-at-baseboard-heater', 1600, 1200, 'A baseboard heater left in place, the floor refinished cleanly around it.', 'ch2-07'),
    detail('06-09-detail-register-reflected-in-finish', 1600, 1200, 'A floor register and its reflection, showing the edge work around a fixed vent.', 'ch2-03'),
    detail('06-10-detail-finished-floor-raw-drywall', 1200, 1600, 'A completed floor against still-open drywall — the floor finished before the walls.', 'ch2-10'),
    detail('07-01-detail-cabinet-box-over-finished-floor', 1200, 1600, 'A raw cabinet box and a work light standing on a floor that was finished first.', 'ch2-11'),
    detail('07-02-detail-curved-tread-paint-vs-finished-hall', 1200, 1600, 'A curved first tread with paint still on the riser, a finished hallway at its foot.', 'ch2-12'),
    detail('07-03-detail-stripped-stair-nosing', 1200, 1600, 'A sanded stair nosing next to a riser that still carries paint.', 'ch2-12'),
    detail('08-01-detail-hallway-oval-patch-wear', 1200, 1600, 'An old oval repair patch visible in a worn hallway floor before sanding.', 'ch1-01'),
    detail('08-02-detail-tired-finish-haze-scratches', 1600, 1200, 'Haze and a hairline scratch worn through the old finish.', 'ch1-02'),
    detail('08-03-detail-kitchen-dust-under-cabinet-feet', 1200, 1600, 'Dusty kitchen boards under the feet of cabinets that arrived before the floor was refinished.', 'ch1-04'),
    detail('08-04-detail-stair-peeling-paint-layers', 1200, 1600, 'Paint failing in stacked layers on a stair riser.', 'ch1-07'),
    detail('08-05-detail-worn-tread-traffic-grain', 1200, 1600, 'Compressed, worn grain in a stair tread from years of traffic.', 'ch1-08'),
  ],
};

/**
 * Social copy for this record, kept beside the Project so marketing has one
 * place to read it rather than drifting from the source pack. Sequences and
 * captions are taken verbatim (in tone) from the operator brief's README and
 * DETAILS-STORY files, minus the house number and species mentions those
 * source files themselves contain — this file follows the same two rules as
 * the record above.
 */
export const STONE_COTTAGE_SOCIAL_COPY = {
  instagram: {
    /** 10-frame carousel order, wide + detail plates mixed per the brief. */
    frames: [
      { detailId: '05-01-detail-stone-arch-red-door', caption: 'The house is older than the finish. The work starts inside.' },
      { detailId: '08-02-detail-tired-finish-haze-scratches', caption: 'This is a tired film, not a tired house.' },
      { detailId: '08-01-detail-hallway-oval-patch-wear', caption: 'An old patch in the hall. Sanding has to take the whole floor with it.' },
      { detailId: '08-04-detail-stair-peeling-paint-layers', caption: 'Stairs are where a refinish is judged.' },
      { detailId: '06-01-detail-sunshaft-on-sheen', caption: 'Same hall. The finish is what holds the light.' },
      { detailId: '06-02-detail-door-grid-in-sheen', caption: 'A door only reflects like this when the surface is even.' },
      { detailId: '06-03-detail-strip-end-joint-grain', caption: 'Joints tight. Colour even. Grain open again.' },
      { detailId: '07-01-detail-cabinet-box-over-finished-floor', caption: 'Floor first. Kitchen second.' },
      { detailId: '07-03-detail-stripped-stair-nosing', caption: 'Hall done. Treads next.' },
      { detailId: '06-05-detail-floor-through-doorway', caption: 'One house. One floor.' },
    ],
    hashtags: ['#Ecowoods', '#TorontoHardwood', '#FloorRefinishing', '#DustFreeSanding', '#StairRefinishing'],
  },
  linkedin: {
    /** 5-frame feature order. */
    frames: [
      '08-02-detail-tired-finish-haze-scratches',
      '06-01-detail-sunshaft-on-sheen',
      '07-01-detail-cabinet-box-over-finished-floor',
      '07-02-detail-curved-tread-paint-vs-finished-hall',
      '06-04-detail-baseboard-reveal-line',
    ],
    body: 'Most Toronto main floors need this every 7–10 years: sand to bare wood, rebuild the finish, leave the architecture alone. This house was photographed twice — worn film and traffic paths, then the same rooms after the finish. The kitchen boxes arrived on a floor that was already done. The hall was finished while the stair was still mid-strip. That sequence is the job.\n\nEcowoods — refinishing, dust-free sanding, stair refinishing. Fixed price in writing. Toronto and the GTA.',
  },
} as const;
