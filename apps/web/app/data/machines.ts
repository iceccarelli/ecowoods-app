import { MACHINE_IMAGES } from './machine-images';

export type Machine = {
  slug: string;
  name: string;
  stage: string;
  tagline: string;
  does: string;
  description: string;
  alt: string;
};

export const machineImages = (slug: string) => MACHINE_IMAGES[slug];

export const machines: Machine[] = [
  {
    slug: 'drum-sander',
    name: 'Drum Floor Sander',
    stage: 'Sanding & refinishing',
    tagline: 'Sanded to bare wood — dead flat.',
    does: 'Sands hardwood to bare wood',
    description: 'The primary sander that takes a hardwood floor down to fresh bare wood so stain and finish sit perfectly. Run under full HEPA dust containment — the foundation of a dust-free refinish.',
    alt: 'Craftsman operating a drum floor sander on a Toronto hardwood floor',
  },
  {
    slug: 'edger',
    name: 'Edger Sander',
    stage: 'Sanding & refinishing',
    tagline: 'Edges and corners the drum can\'t reach.',
    does: 'Sands perimeters and corners',
    description: 'A compact, powerful sander designed specifically for the perimeter of the room and tight spaces around doorways and cabinets. Ensures every inch of the floor receives the same professional preparation.',
    alt: 'Craftsman using an edger sander along the baseboard of a hardwood floor',
  },
  {
    slug: 'orbital-sander',
    name: 'Random-Orbital Floor Sander',
    stage: 'Sanding & refinishing',
    tagline: 'Swirl-free fine finish sanding.',
    does: 'Fine, swirl-free finish sanding',
    description: 'The final sanding pass that removes any remaining marks and leaves the surface perfectly smooth and ready for stain. Essential for a high-end, glass-like finish that lasts.',
    alt: 'Random-orbital floor sander in use on sanded hardwood',
  },
  {
    slug: 'buffer',
    name: 'Buffer / Rotary Floor Polisher',
    stage: 'Sanding & refinishing',
    tagline: 'Screens between coats for a flawless surface.',
    does: 'Screens and polishes finish coats',
    description: 'Used between finish coats to lightly abrade the surface so the next coat bonds perfectly. Also polishes the final coat to the desired sheen — the difference between a good floor and a great one.',
    alt: 'Rotary buffer polishing a hardwood floor between finish coats',
  },
  {
    slug: 'dust-containment',
    name: 'HEPA Dust-Containment System',
    stage: 'Sanding & refinishing',
    tagline: 'The zero-dust promise, delivered.',
    does: 'Captures dust at the source',
    description: 'Industrial HEPA filtration connected directly to every sanding machine. Captures the vast majority of dust at the source so your home stays clean during and after the job — the hallmark of a professional Ecowoods refinish.',
    alt: 'HEPA dust extractor connected to floor sanding equipment on a job site',
  },
  {
    slug: 'flooring-nailer',
    name: 'Pneumatic Flooring Nailer',
    stage: 'Installation & prep',
    tagline: 'Precision fastening, board after board.',
    does: 'Fastens solid hardwood boards',
    description: 'The industry-standard tool that drives nails or staples at the exact angle and depth required for solid hardwood. Combined with a mallet, it seats each board tightly for a floor that stays quiet and solid for decades.',
    alt: 'Craftsman using a pneumatic flooring nailer and mallet on hardwood planks',
  },
  {
    slug: 'table-saw',
    name: 'Table Saw',
    stage: 'Installation & prep',
    tagline: 'Rips boards to the exact width needed.',
    does: 'Rips boards to width',
    description: 'Used on site to rip the final boards in each row to the precise width so the floor fits the room perfectly with no gaps or forced joints. A mark of careful, professional layout.',
    alt: 'Table saw set up on a hardwood flooring job site for ripping boards',
  },
  {
    slug: 'miter-saw',
    name: 'Compound Miter Saw',
    stage: 'Installation & prep',
    tagline: 'Clean angles for borders and patterns.',
    does: 'Cuts precise angles and patterns',
    description: 'Delivers the precise angle cuts required for borders, transitions, herringbone, chevron, and custom layouts. Accuracy here is what separates a standard install from true craftsmanship.',
    alt: 'Compound miter saw cutting hardwood for a border or pattern',
  },
  {
    slug: 'jamb-saw',
    name: 'Jamb / Undercut Saw',
    stage: 'Installation & prep',
    tagline: 'Boards slide cleanly under casings.',
    does: 'Undercuts casings and jambs',
    description: 'Undercuts door jambs, casings, and baseboards so the new hardwood can run underneath for a seamless, professional look with no awkward scribe cuts or gaps.',
    alt: 'Jamb saw undercutting a door casing for hardwood flooring',
  },
  {
    slug: 'moisture-meter',
    name: 'Moisture Meter',
    stage: 'Installation & prep',
    tagline: 'No unforeseen conditions.',
    does: 'Tests subfloor and wood moisture',
    description: 'Every Ecowoods job begins with thorough moisture testing of both the subfloor and the new hardwood. This simple tool prevents the most common causes of future problems — cupping, crowning, and gaps.',
    alt: 'Moisture meter reading on a plywood subfloor before hardwood installation',
  },
  {
    slug: 'finish-applicators',
    name: 'Finish Applicators',
    stage: 'Finishing & detail',
    tagline: 'Even coats, professional results.',
    does: 'Applies adhesive and finish coats',
    description: 'T-bar applicators, lambswool pads, and specialty trowels ensure adhesive for glue-down installations and finish coats are applied evenly and at the correct thickness. The difference is visible in the final clarity and durability of the floor.',
    alt: 'T-bar applicator spreading finish on a newly sanded hardwood floor',
  },
  {
    slug: 'router',
    name: 'Router & Inlay Tools',
    stage: 'Finishing & detail',
    tagline: 'Custom borders and bespoke details.',
    does: 'Creates custom inlays and borders',
    description: 'When a client wants a custom border, feature strip, or inlay, these tools create the precise recesses and profiles. This is where a floor becomes truly one-of-a-kind.',
    alt: 'Router being used to create a custom border or inlay in hardwood flooring',
  },
];
