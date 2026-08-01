/**
 * Ecowoods — Shop Product Seed Script
 *
 * Upserts the shop catalog (by `slug`) shown on the customer dashboard
 * Checkout section. Safe to re-run — it never deletes rows, so it can be
 * used against a live database.
 *
 * ⚠️ PRICES ARE PLACEHOLDER MATERIAL RATES — replace `basePrice` /
 *    `priceDelta` with Ecowoods' real per-sq-ft material cost and accessory
 *    pricing before this goes live (same convention as PricingSection.tsx's
 *    labor rates).
 *
 * Usage:
 *   npx tsx prisma/seed-products.ts
 */

import { PrismaClient, ProductCategory, ProductUnit } from '@prisma/client';

const db = new PrismaClient();

type OptionChoice = { label: string; priceDelta: number };
type OptionGroup = { name: string; choices: OptionChoice[] };

const FINISH_OPTION: OptionGroup[] = [
  {
    name: 'Finish',
    choices: [
      { label: 'Standard hardwax-oil (included)', priceDelta: 0 },
      { label: 'Premium Rubio Monocoat (+$0.75/sq ft)', priceDelta: 0.75 },
    ],
  },
];

const materials: Array<{
  slug: string;
  name: string;
  species: string;
  format: string;
  janka: number;
  basePrice: number;
  description: string;
}> = [
  { slug: 'white-oak-wideplank', name: 'White Oak — Wide Plank', species: 'White Oak', format: 'Wide Plank', janka: 1360, basePrice: 9.75, description: 'Ontario & Quebec white oak, natural matte hardwax-oil.' },
  { slug: 'walnut-chevron', name: 'Black Walnut — Chevron', species: 'Black Walnut', format: 'Chevron', janka: 1010, basePrice: 15.50, description: 'True 45° chevron-cut walnut, smoked & oiled.' },
  { slug: 'hickory-wideplank', name: 'Hickory — Wide Plank', species: 'Hickory', format: 'Wide Plank', janka: 1820, basePrice: 8.25, description: 'Matte hardwax-oil, dramatic light-to-dark grain.' },
  { slug: 'white-oak-herringbone', name: 'White Oak — Herringbone', species: 'White Oak', format: 'Herringbone', janka: 1360, basePrice: 12.75, description: 'White-washed matte herringbone.' },
  { slug: 'red-oak-strip', name: 'Red Oak — Classic Strip', species: 'Red Oak', format: 'Classic Strip', janka: 1290, basePrice: 6.50, description: '2¼" strip, golden satin finish.' },
  { slug: 'maple-wideplank', name: 'Hard Maple — Wide Plank', species: 'Hard Maple', format: 'Wide Plank', janka: 1450, basePrice: 8.95, description: 'Clear natural matte, bright and uniform grain.' },
  { slug: 'walnut-wideplank', name: 'Black Walnut — Wide Plank', species: 'Black Walnut', format: 'Wide Plank', janka: 1010, basePrice: 13.25, description: 'Rubio Monocoat hardwax-oil, deep chocolate tones.' },
  { slug: 'ash-wideplank', name: 'White Ash — Wide Plank', species: 'White Ash', format: 'Wide Plank', janka: 1320, basePrice: 8.50, description: 'Natural matte, pale open grain.' },
  { slug: 'maple-herringbone', name: 'Hard Maple — Herringbone', species: 'Hard Maple', format: 'Herringbone', janka: 1450, basePrice: 11.25, description: 'Clear natural matte herringbone.' },
  { slug: 'red-oak-wideplank', name: 'Red Oak — Wide Plank', species: 'Red Oak', format: 'Wide Plank', janka: 1290, basePrice: 7.25, description: 'Low-sheen satin, warm honey tone.' },
  { slug: 'hickory-herringbone', name: 'Hickory — Herringbone', species: 'Hickory', format: 'Herringbone', janka: 1820, basePrice: 12.50, description: 'Matte hardwax-oil herringbone, bold contrast.' },
  { slug: 'ash-herringbone', name: 'White Ash — Herringbone', species: 'White Ash', format: 'Herringbone', janka: 1320, basePrice: 11.50, description: 'Clean, calm herringbone in open-grain ash.' },
];

const accessories: Array<{
  slug: string;
  name: string;
  basePrice: number;
  description: string;
}> = [
  { slug: 'finish-sample-kit', name: 'Finish Sample Kit (3 boards)', basePrice: 15, description: 'Three real finished board samples, shipped to your door — see the grain and sheen before you order.' },
  { slug: 'rubio-monocoat-oil-1l', name: 'Rubio Monocoat Maintenance Oil (1L)', basePrice: 65, description: 'Refresh the oil finish on an existing Ecowoods floor.' },
  { slug: 'bona-hardwax-refresher', name: 'Bona Hardwax Refresher (750ml)', basePrice: 45, description: 'Spot-clean and refresh hardwax-oil finishes between full recoats.' },
  { slug: 'felt-furniture-pads', name: 'Felt Furniture Pads (Set of 20)', basePrice: 12, description: 'Protect your new floor from scuffs under chairs and furniture legs.' },
  { slug: 'premium-rug-pad-8x10', name: 'Non-Slip Rug Pad — 8x10 ft', basePrice: 85, description: 'Felt + rubber pad sized for an 8x10 ft area rug, safe on hardwood.' },
];

async function main() {
  console.log('🌱 Seeding shop products (upsert by slug — non-destructive)...
');

  for (const m of materials) {
    await db.product.upsert({
      where: { slug: m.slug },
      update: {
        name: m.name,
        species: m.species,
        format: m.format,
        janka: m.janka,
        basePrice: m.basePrice,
        description: m.description,
        options: FINISH_OPTION,
      },
      create: {
        slug: m.slug,
        name: m.name,
        category: ProductCategory.MATERIAL,
        unit: ProductUnit.SQFT,
        basePrice: m.basePrice,
        minQuantity: 50,
        species: m.species,
        format: m.format,
        janka: m.janka,
        description: m.description,
        options: FINISH_OPTION,
      },
    });
  }
  console.log(`  ✓ ${materials.length} material products upserted`);

  for (const a of accessories) {
    await db.product.upsert({
      where: { slug: a.slug },
      update: {
        name: a.name,
        basePrice: a.basePrice,
        description: a.description,
      },
      create: {
        slug: a.slug,
        name: a.name,
        category: ProductCategory.ACCESSORY,
        unit: ProductUnit.EACH,
        basePrice: a.basePrice,
        minQuantity: 1,
        description: a.description,
        options: [],
      },
    });
  }
  console.log(`  ✓ ${accessories.length} accessory products upserted`);

  console.log('
✅ Product seed complete!
');
}

main()
  .catch((e) => {
    console.error('❌ Product seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
