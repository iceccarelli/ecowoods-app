/**
 * Resolve hooks that let plain Node (22.18+, type stripping on by default)
 * import the web app's TypeScript registries without a build: the `@/` and
 * `@ecowoods/*` aliases from apps/web/tsconfig.json, plus extensionless and
 * directory imports. Used by verifiers that must measure what the app computes
 * rather than re-parse its source with a regex.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ALIASES = [
  ['@/', path.join(ROOT, 'apps/web') + '/'],
  ['@ecowoods/shared/', path.join(ROOT, 'packages/shared/src') + '/'],
  ['@ecowoods/types/', path.join(ROOT, 'packages/types/src') + '/'],
];
const EXACT = {
  '@ecowoods/shared': path.join(ROOT, 'packages/shared/src'),
  '@ecowoods/types': path.join(ROOT, 'packages/types/src'),
};
const EXTS = ['.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx', '/index.js'];

function probe(base) {
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  for (const e of EXTS) if (fs.existsSync(base + e)) return base + e;
  return null;
}

export async function resolve(specifier, context, next) {
  let target = EXACT[specifier] ?? null;
  for (const [prefix, dir] of ALIASES) if (!target && specifier.startsWith(prefix)) target = dir + specifier.slice(prefix.length);
  if (!target && (specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    target = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }
  if (target) {
    const hit = probe(target);
    if (hit) return next(pathToFileURL(hit).href, context);
  }
  return next(specifier, context);
}

/** Image imports (next/image static imports) become a placeholder module: verifiers read registries, not pixels. */
export async function load(url, context, next) {
  if (/\.(jpe?g|png|webp|avif|gif|svg|ico)$/i.test(url)) {
    return { format: 'module', shortCircuit: true, source: `export default ${JSON.stringify({ src: url, width: 1, height: 1 })};` };
  }
  return next(url, context);
}
