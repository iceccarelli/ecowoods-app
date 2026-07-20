/**
 * The EcoWoods floor collection — 12 products, each with a room / detail /
 * lifestyle image triptych. Species facts mirror `speciesList` in the pricing
 * section (single source of truth for Janka + origin). Images live in
 * /public/gallery and are referenced root-relative, so no next.config
 * remotePatterns change is needed.
 *
 * These are representative finish/style images of the floors we install across
 * the GTA — not documentation of one specific address. Copy is written to
 * convert: species truth first, then the room it belongs in.
 */

export type FloorFormat = 'Wide Plank' | 'Herringbone' | 'Chevron' | 'Classic Strip';

export type Floor = {
  slug: string;
  name: string;
  species: string;
  format: FloorFormat;
  janka: number;
  origin: string;
  finish: string;
  tagline: string;
  description: string;
  bestFor: string;
  /** desktop mosaic width on the 12-col grid */
  span: 'span-4' | 'span-6' | 'span-8';
};

const g = (slug: string, shot: 'room' | 'detail' | 'lifestyle') =>
  `/gallery/${slug}-${shot === 'room' ? '01-room' : shot === 'detail' ? '02-detail' : '03-lifestyle'}.webp`;

export const floorImages = (slug: string) => ({
  room: g(slug, 'room'),
  detail: g(slug, 'detail'),
  lifestyle: g(slug, 'lifestyle'),
});

export const floors: Floor[] = [
  {
    slug: 'white-oak-wideplank',
    name: 'White Oak — Wide Plank',
    species: 'White Oak',
    format: 'Wide Plank',
    janka: 1360,
    origin: 'Ontario & Quebec',
    finish: 'Natural matte hardwax-oil',
    tagline: 'The calm, modern Canadian classic.',
    description:
      'Our most-requested floor. Wide boards of Ontario & Quebec white oak in a natural matte hardwax-oil that lets the grain breathe — cool enough for a minimalist condo, warm enough for a family home. Infinitely stainable if you ever want to go darker.',
    bestFor: 'Open-plan living & modern renovations',
    span: 'span-8',
  },
  {
    slug: 'walnut-chevron',
    name: 'Black Walnut — Chevron',
    species: 'Black Walnut',
    format: 'Chevron',
    janka: 1010,
    origin: 'Eastern North America',
    finish: 'Smoked & oiled',
    tagline: 'The penthouse floor.',
    description:
      'Walnut cut to a true 45° chevron, so every board meets its neighbour in an unbroken point down the room. Dark, precise, architectural. This is the floor people photograph before they photograph the view.',
    bestFor: 'Penthouses & statement spaces',
    span: 'span-4',
  },
  {
    slug: 'hickory-wideplank',
    name: 'Hickory — Wide Plank',
    species: 'Hickory',
    format: 'Wide Plank',
    janka: 1820,
    origin: 'Eastern North America',
    finish: 'Matte hardwax-oil',
    tagline: 'The toughest floor we sell.',
    description:
      'At Janka 1820, hickory laughs at kids, dogs, and dining chairs. Wide boards show off its dramatic light-to-dark variation and pronounced grain — beauty that never needs to be babied.',
    bestFor: 'High-traffic family homes & entryways',
    span: 'span-4',
  },
  {
    slug: 'white-oak-herringbone',
    name: 'White Oak — Herringbone',
    species: 'White Oak',
    format: 'Herringbone',
    janka: 1360,
    origin: 'Ontario & Quebec',
    finish: 'White-washed matte',
    tagline: 'Old-world geometry, gallery-white light.',
    description:
      'White oak milled into a precise herringbone and finished in a soft white-wash. The pattern draws the eye the length of a room; the pale tone keeps it current, not period. A statement floor that still reads as restrained.',
    bestFor: 'Foyers, formal living & feature rooms',
    span: 'span-8',
  },
  {
    slug: 'red-oak-strip',
    name: 'Red Oak — Classic Strip',
    species: 'Red Oak',
    format: 'Classic Strip',
    janka: 1290,
    origin: 'Northern Ontario',
    finish: 'Golden satin',
    tagline: 'The heritage Toronto floor, done right.',
    description:
      'The 2¼-inch red oak strip that has been underfoot in Toronto homes for a century — re-imagined with a warm golden satin finish and a dead-flat, dust-free sand. Timeless, honest, and built to be refinished again in 30 years.',
    bestFor: 'Century homes & heritage restorations',
    span: 'span-6',
  },
  {
    slug: 'maple-wideplank',
    name: 'Hard Maple — Wide Plank',
    species: 'Hard Maple',
    format: 'Wide Plank',
    janka: 1450,
    origin: 'Ontario & Quebec',
    finish: 'Clear natural matte',
    tagline: 'Bright, seamless, uncompromisingly clean.',
    description:
      'Hard maple’s tight, uniform grain gives a near-seamless surface — the brightest, most contemporary floor we lay. A clear natural finish keeps it pale and calm, and Janka 1450 takes a busy household without complaint.',
    bestFor: 'Contemporary & minimalist interiors',
    span: 'span-6',
  },
  {
    slug: 'walnut-wideplank',
    name: 'Black Walnut — Wide Plank',
    species: 'Black Walnut',
    format: 'Wide Plank',
    janka: 1010,
    origin: 'Eastern North America',
    finish: 'Rubio Monocoat hardwax-oil',
    tagline: 'Deep, quiet luxury underfoot.',
    description:
      'Eastern black walnut in generous planks, finished in a natural oil that deepens its chocolate tones without a hint of plastic sheen. Softer than oak, but unmistakably high-end — the floor that makes a room feel considered.',
    bestFor: 'Principal suites, libraries & luxury condos',
    span: 'span-8',
  },
  {
    slug: 'ash-wideplank',
    name: 'White Ash — Wide Plank',
    species: 'White Ash',
    format: 'Wide Plank',
    janka: 1320,
    origin: 'Ontario',
    finish: 'Natural matte',
    tagline: 'Light, airy, quietly resilient.',
    description:
      'Ontario white ash gives you the pale, Scandinavian palette of white oak with a straighter, more open grain — and real resilience underfoot. A fresh, understated floor that makes small rooms feel larger.',
    bestFor: 'Condos & bright modern renovations',
    span: 'span-4',
  },
  {
    slug: 'maple-herringbone',
    name: 'Hard Maple — Herringbone',
    species: 'Hard Maple',
    format: 'Herringbone',
    janka: 1450,
    origin: 'Ontario & Quebec',
    finish: 'Clear natural matte',
    tagline: 'Scandinavian light, pattern-perfect.',
    description:
      'The uniformity of hard maple makes its herringbone almost luminous — a pale, even weave with none of the busyness of higher-contrast species. Understated geometry for rooms that want light and order.',
    bestFor: 'Scandi-inspired interiors & sunrooms',
    span: 'span-4',
  },
  {
    slug: 'red-oak-wideplank',
    name: 'Red Oak — Wide Plank',
    species: 'Red Oak',
    format: 'Wide Plank',
    janka: 1290,
    origin: 'Northern Ontario',
    finish: 'Low-sheen satin',
    tagline: 'Classic warmth, contemporary width.',
    description:
      'The warmth of Northern Ontario red oak in a wide-plank format, finished in a low-sheen satin that softens its natural undertone into a rich honey. Familiar and welcoming, with a modern footprint.',
    bestFor: 'Family homes & warm modern interiors',
    span: 'span-8',
  },
  {
    slug: 'hickory-herringbone',
    name: 'Hickory — Herringbone',
    species: 'Hickory',
    format: 'Herringbone',
    janka: 1820,
    origin: 'Eastern North America',
    finish: 'Matte hardwax-oil',
    tagline: 'Rugged character, refined layout.',
    description:
      'Hickory’s bold contrast set into a herringbone — the pattern’s discipline balances the wood’s wildness for a floor that’s characterful without being chaotic. Nearly indestructible, and impossible to ignore.',
    bestFor: 'Feature floors that still take heavy wear',
    span: 'span-6',
  },
  {
    slug: 'ash-herringbone',
    name: 'White Ash — Herringbone',
    species: 'White Ash',
    format: 'Herringbone',
    janka: 1320,
    origin: 'Ontario',
    finish: 'Natural matte',
    tagline: 'Understated geometry, airy tone.',
    description:
      'White ash milled to a clean herringbone — light, linear, and calm. The open grain keeps the pattern feeling contemporary rather than ornate. Pattern with a whisper, not a shout.',
    bestFor: 'Modern foyers & feature floors',
    span: 'span-6',
  },
];
