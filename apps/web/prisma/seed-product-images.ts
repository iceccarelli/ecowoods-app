/**
 * Ecowoods — Accessory Product Image Enrichment
 *
 * MATERIAL products already have real Ecowoods photography bundled via
 * `app/data/floor-images.ts` (matched by slug at render time — see
 * `mypage/page.tsx`), so this script only touches ACCESSORY products, which
 * have no existing photography.
 *
 * Uses the same Unsplash Search API + `UNSPLASH_ACCESS_KEY` pattern already
 * proven in `app/api/backgrounds/route.ts`, but — unlike that route — it
 * resolves an image ONCE and persists it to `Product.imageUrl` /
 * `imageCredit` / `imageCreditUrl`, rather than calling Unsplash on every
 * dashboard page load. Safe to re-run: skips any product that already has
 * an `imageUrl`, unless run with --force.
 *
 * Usage:
 *   npx tsx prisma/seed-product-images.ts
 *   npx tsx prisma/seed-product-images.ts --force   (re-fetch even if set)
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const force = process.argv.includes('--force');

const QUERIES: Record<string, string> = {
  'finish-sample-kit': 'hardwood floor wood sample swatches',
  'rubio-monocoat-oil-1l': 'wood care oil bottle',
  'bona-hardwax-refresher': 'wood floor cleaning spray bottle',
  'felt-furniture-pads': 'felt furniture pads chair legs',
  'premium-rug-pad-8x10': 'area rug pad rolled',
};

async function fetchUnsplashImage(query: string, key: string) {
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&content_filter=high`,
    { headers: { Authorization: `Client-ID ${key}` } }
  );
  if (!res.ok) throw new Error(`Unsplash request failed: ${res.status}`);
  const data = await res.json();
  const photo = data.results?.[0];
  if (!photo) return null;
  return {
    url: photo.urls.small as string,
    credit: (photo.user?.name as string) ?? 'Unsplash',
    creditUrl: (photo.user?.links?.html as string) ?? 'https://unsplash.com',
  };
}

async function main() {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    console.error('❌ UNSPLASH_ACCESS_KEY not set — nothing to do.');
    process.exit(1);
  }

  console.log('🖼️  Enriching accessory products with Unsplash photos...
');

  const accessories = await db.product.findMany({
    where: { category: 'ACCESSORY', ...(force ? {} : { imageUrl: null }) },
  });

  if (accessories.length === 0) {
    console.log('  Nothing to do — all accessories already have images (use --force to re-fetch).');
    return;
  }

  for (const product of accessories) {
    const query = QUERIES[product.slug] ?? product.name;
    try {
      const image = await fetchUnsplashImage(query, key);
      if (!image) {
        console.warn(`  ⚠️  No Unsplash result for "${product.name}" (query: ${query})`);
        continue;
      }
      await db.product.update({
        where: { id: product.id },
        data: { imageUrl: image.url, imageCredit: image.credit, imageCreditUrl: image.creditUrl },
      });
      console.log(`  ✓ ${product.name} → photo by ${image.credit}`);
    } catch (err) {
      console.error(`  ✗ ${product.name}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log('
✅ Accessory image enrichment complete!
');
}

main()
  .catch((e) => {
    console.error('❌ Image enrichment failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
