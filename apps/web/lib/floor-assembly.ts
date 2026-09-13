/**
 * lib/floor-assembly.ts — what a floor is actually made of.
 *
 * WHY THIS EXISTS
 *
 * The homepage sold a finished floor with photographs of a finished floor. A
 * finished floor is the one part of the job a competitor can photograph too,
 * and it is the part a buyer cannot evaluate: every sanded floor looks good on
 * the day it is handed over. The four layers underneath it are where the price
 * differences live, where the failures come from, and where this company can
 * say something its competitors cannot — and none of them were on the page.
 *
 * So this module is the record for the exploded assembly: five layers, in the
 * order they are built, each with the question a buyer should put to whoever is
 * quoting them. It is data rather than markup because the same five layers
 * belong on /estimate, on the guides, and in the spec sheet, and five copies of
 * a list is how four of them go stale.
 *
 * THE SPECIES JOIN IS NOT A SECOND LIST.
 *
 * The wear layer is painted with a real photographed grain crop from
 * public/textures, and those crops are already keyed by the SAME product ids as
 * lib/floor-studio/catalog.ts. So the species shown here derive from
 * FLOOR_PRODUCTS and the texture path is computed from the product id. There is
 * no array of species in this file to drift from the catalogue, and
 * floor-assembly.test.ts fails if a product ever exists without its crop.
 *
 * NOTHING HERE IS A CLAIM ABOUT A JOB. The layers are how hardwood floors are
 * built; the copy describes the trade, not a customer, an address or a result.
 */
import { FLOOR_PRODUCTS, type FloorProduct } from '@/lib/floor-studio/catalog';

export type AssemblyLayer = {
  /** Display index, top of the build-up first. */
  n: string;
  id: string;
  title: string;
  /** What the layer is, in the words a homeowner would use. */
  body: string;
  /**
   * The question to put to whoever is quoting. This is the commercial point of
   * the whole graphic: a buyer who asks these five questions can tell two
   * quotes apart, and a quote that answers them is ours.
   */
  ask: string;
};

/** Top of the build-up first — the order you meet them, not the order they are laid. */
export const ASSEMBLY_LAYERS: readonly AssemblyLayer[] = [
  {
    n: '01',
    id: 'finish',
    title: 'Finish',
    body: 'Coats applied on site or in the mill. What you walk on, and the only layer that can be renewed without lifting a board.',
    ask: 'How many coats, and of what — and is the last one sanded between?',
  },
  {
    n: '02',
    id: 'wear-layer',
    title: 'Wear layer',
    body: 'The sandable thickness above the tongue. It decides how many times this floor can ever be refinished.',
    ask: 'How many millimetres above the tongue? That number sets how many refinishes you get.',
  },
  {
    n: '03',
    id: 'fastening',
    title: 'Fastening',
    body: 'Cleat, staple or adhesive, chosen for the substrate underneath. The wrong choice is silent for a year and then audible every winter.',
    ask: 'Which fastening, and why that one for my subfloor?',
  },
  {
    n: '04',
    id: 'moisture-control',
    title: 'Moisture control',
    body: 'Barrier or membrane, specified from a meter reading of the slab or the plywood rather than from habit.',
    ask: 'What did the moisture meter read, on what day, and what did you specify from it?',
  },
  {
    n: '05',
    id: 'substrate',
    title: 'Substrate',
    body: 'Plywood or slab, flattened to tolerance before anything is laid on it. Everything above inherits whatever is wrong here.',
    ask: 'What flatness tolerance, and what happens to the price if the floor misses it?',
  },
] as const;

/** Layers whose specification a visitor can be shown a number for on this site. */
export const ASSEMBLY_LAYER_COUNT = ASSEMBLY_LAYERS.length;

export function layerById(id: string): AssemblyLayer | undefined {
  return ASSEMBLY_LAYERS.find((l) => l.id === id);
}

/**
 * The photographed grain crop for a product.
 *
 * public/textures/grain-manifest.json records one crop per product, named by
 * the product id. Computed rather than stored so a new species in the
 * catalogue needs a crop and nothing else.
 */
export function grainTextureFor(productId: string): string {
  return `/textures/grain-${productId}.webp`;
}

/** The species the assembly can be shown in — the catalogue, not a copy of it. */
export const ASSEMBLY_SPECIES: readonly FloorProduct[] = FLOOR_PRODUCTS;

/** The default face. White oak is the product most Toronto renovations specify. */
export const ASSEMBLY_DEFAULT_SPECIES = 'white-oak';

/**
 * The exit, and the ONE place it is built.
 *
 * TWO SILENT DROPS THIS AVOIDS, both found by reading the receiving code
 * rather than by trusting the parameter name.
 *
 *   1. /estimate reads a configuration through designConfigFromParams, which
 *      returns null unless species AND a positive sqft are both present. The
 *      assembly never asks for an area, so a link straight to /estimate would
 *      have carried a species that the form discards on arrival — the exact
 *      failure MEAS-04 fixed for the spec sheet.
 *   2. /design matches its species param against FloorConfigurator's SPECIES,
 *      whose `id` is the product's RATE KEY ('white oak'), not its catalogue
 *      id ('white-oak'). A link built from the id would be dropped by the
 *      `SPECIES.some(...)` guard without any error.
 *
 * So the assembly hands off to the configurator — which is where an area is
 * asked for — keyed by rateKey. /design then builds the /estimate link itself
 * through designEstimateHref, with the area filled in, and the handoff holds.
 * floor-assembly.test.ts asserts the rateKey round-trip against the catalogue.
 */
export function assemblyDesignHref(product: FloorProduct): string {
  const params = new URLSearchParams({ species: product.rateKey, source: 'assembly' });
  return `/design?${params.toString()}`;
}
