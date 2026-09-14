/**
 * plate.test.ts — the endpoint that needs no photograph, and the wire it goes out on.
 *
 * Runs on Node alone: `pnpm --filter @ecowoods/render-api test`. This service
 * has no dependencies, which includes no test runner, so the assertions are a
 * function and a counter. It needs the loader, because it imports the renderer
 * out of apps/web rather than vendoring a copy of it — that is the point of the
 * design and the reason this file runs with --import ./src/register.mjs.
 */
import { encodePng, decodePng } from './png.ts';
import { grainFor, warmGrain } from './textures.ts';
import { renderFloorPlate, createPlateBuffer } from '@/lib/floor-studio/plate';
import { GRAIN_TILES } from '@/lib/floor-studio/grain';
import { FLOOR_PRODUCTS } from '@/lib/floor-studio/catalog';

let failed = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  if (cond) console.log('  ✓', name, extra ? `(${extra})` : '');
  else {
    failed += 1;
    console.log('  ✗', name, extra);
  }
};

console.log('the tiles this service can actually read');
const warm = warmGrain();
ok('every catalogue species has a decodable PNG tile', warm.missing.length === 0, warm.missing.join(', '));
ok('one tile per catalogue product', warm.loaded === FLOOR_PRODUCTS.length, `${warm.loaded} of ${FLOOR_PRODUCTS.length}`);

/* THE SIZE IN INCHES IS NOT THE SIZE IN PIXELS. The PNG copies are a quarter of
   the linear resolution of the webp the website serves, and they are the same
   piece of wood: six inches of hickory is six inches at 512 texels or at 256.
   Scaling the declared inches by the pixel ratio is right for a crop and wrong
   for a resize, and it was wrong here for an hour — every floor this API drew
   came out at double the grain scale, looking entirely plausible. */
for (const tile of GRAIN_TILES) {
  const tex = grainFor(tile.product);
  ok(
    `${tile.product} measures what the catalogue says, not what the copy's pixels say`,
    !!tex && tex.inchesAcross === tile.inchesAcross && tex.inchesAlong === tile.inchesAlong,
    tex ? `${tex.width}px = ${tex.inchesAcross}in` : 'no tile',
  );
}

console.log('\nthe plate');
const cfg = { productId: 'hickory', finishId: 'satin', patternId: 'herringbone', widthId: '7' };
const plate = renderFloorPlate({ width: 240, height: 180, config: cfg, grain: grainFor('hickory') ?? undefined });
let opaque = true;
for (let i = 3; i < plate.data.length; i += 4) if (plate.data[i] !== 255) opaque = false;
ok('is fully opaque, which is what lets the PNG drop a channel', opaque);

const drawn = renderFloorPlate({ width: 240, height: 180, config: cfg });
let differs = 0;
for (let i = 0; i < plate.data.length; i += 1) if (plate.data[i] !== drawn.data[i]) differs += 1;
ok('the photograph actually changes the picture', differs > plate.data.length / 10, `${differs} bytes differ`);

const buffer = createPlateBuffer(240, 180);
for (let y = 0; y < 180; y += 41) {
  renderFloorPlate({ width: 240, height: 180, config: cfg, grain: grainFor('hickory') ?? undefined, into: buffer, rows: [y, Math.min(180, y + 41)] });
}
let bandDiff = 0;
for (let i = 0; i < buffer.data.length; i += 1) if (buffer.data[i] !== plate.data[i]) bandDiff += 1;
ok('renders the same in bands as in one pass', bandDiff === 0, `${bandDiff} bytes differ`);

console.log('\nthe wire');
/* Sub filtering and dropping the alpha channel are worth a quarter of every
   byte this endpoint will ever serve, and both are lossless or they are bugs. */
for (const wantOpaque of [false, true]) {
  const png = encodePng(plate, wantOpaque);
  const back = decodePng(png);
  let maxDelta = 0;
  for (let i = 0; i < back.data.length; i += 1) {
    if (i % 4 === 3) continue;
    maxDelta = Math.max(maxDelta, Math.abs(back.data[i]! - plate.data[i]!));
  }
  ok(
    `${wantOpaque ? 'RGB' : 'RGBA'} survives a round trip unchanged`,
    back.width === plate.width && back.height === plate.height && maxDelta === 0,
    `max channel Δ ${maxDelta}`,
  );
  let alphaOk = true;
  for (let i = 3; i < back.data.length; i += 4) if (back.data[i] !== 255) alphaOk = false;
  ok(`${wantOpaque ? 'RGB' : 'RGBA'} decodes to full alpha`, alphaOk);
}

const rgba = encodePng(plate, false).length;
const rgb = encodePng(plate, true).length;
ok('dropping the alpha channel makes it smaller, not larger', rgb < rgba, `${rgb} < ${rgba}`);

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
