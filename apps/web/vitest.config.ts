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
