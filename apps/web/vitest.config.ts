/**
 * vitest — unit and contract tests for apps/web.
 *
 *   pnpm --filter @ecowoods/web test        (also: pnpm test:web from the root)
 *
 * Node environment: the tests exercise the registry, the matcher and the
 * /api/v1 route handlers in-process, with real Request objects and no server.
 * Static image imports (next/image metadata) are stubbed so lib/brand-assets
 * loads outside the Next build.
 */
import { defineConfig, type Plugin } from 'vitest/config';
import path from 'node:path';

const imageStub = (): Plugin => ({
  name: 'ecowoods-image-stub',
  enforce: 'pre',
  resolveId(id) {
    if (/\.(jpg|jpeg|png|webp|avif|gif|svg)$/i.test(id) && !id.includes('node_modules')) return `\0img:${path.basename(id)}`;
    return null;
  },
  load(id) {
    if (id.startsWith('\0img:')) {
      const name = id.slice(5);
      return `export default { src: '/_next/static/media/${name}', width: 1200, height: 630, blurDataURL: '' };`;
    }
    return null;
  },
});

export default defineConfig({
  plugins: [imageStub()],
  /* THE AUTOMATIC JSX RUNTIME, WHICH IS WHY ONE SUITE HAS NEVER RUN.
   *
   * tsconfig.json says `"jsx": "preserve"`, which is correct — Next owns that
   * transform. esbuild reads it, finds no runtime it can emit, and falls back
   * to the CLASSIC one: `React.createElement`. Next components do not import
   * the React default, because under the automatic runtime they have no reason
   * to, so the first component this suite rendered threw
   * `ReferenceError: React is not defined` at its opening `return (`.
   *
   * That is a collection-time throw inside a describe callback, so it did not
   * fail one assertion — it killed the file. lib/floor-assembly.test.ts has
   * reported `(0)` tests since VIS-05, roughly sixty assertions that have never
   * executed once, including the one written specifically to catch F-205
   * (`26026+ Years in Toronto` — three copies of one number concatenating in
   * the served HTML, which no source-level grep can see). The suite that exists
   * to catch a duplication bug was itself silently absent.
   *
   * Nothing is relaxed by this line. It makes a suite RUN that was not running.
   */
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@ecowoods/shared': path.resolve(__dirname, '../../packages/shared'),
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'lib/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
