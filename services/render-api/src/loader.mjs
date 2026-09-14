/**
 * The path aliases the renderer is written against, resolved for a plain Node
 * process. Next does this from tsconfig `paths`; there is no Next here.
 *
 * TWO THINGS THAT ARE NOT OBVIOUS AND BOTH FAILED FIRST:
 *
 * 1. The format must be `module-typescript`, not `module`. Returning `module`
 *    tells Node the file is already JavaScript, so it skips type stripping and
 *    then fails on the first `import type {` — reported as a syntax error deep
 *    inside room.ts, which is a confusing place to look for a loader bug.
 *
 * 2. RELATIVE imports need resolving too. `./catalog` inside apps/web is not a
 *    file; `./catalog.ts` is. Node's own resolver will not add the extension,
 *    so every relative import in the imported subtree lands here as well.
 */
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const WEB = path.join(ROOT, 'apps/web');
const SHARED = path.join(ROOT, 'packages/shared');

const resolveFile = (target) => {
  for (const cand of [target, `${target}.ts`, `${target}.tsx`, path.join(target, 'index.ts')]) {
    if (!existsSync(cand)) continue;
    try {
      if (statSync(cand).isDirectory()) continue;
    } catch {
      continue;
    }
    return cand;
  }
  return null;
};

export async function resolve(spec, ctx, next) {
  let target = null;
  if (spec.startsWith('@ecowoods/shared/')) target = path.join(SHARED, spec.slice('@ecowoods/shared/'.length));
  else if (spec === '@ecowoods/shared') target = path.join(SHARED, 'index');
  else if (spec.startsWith('@/')) target = path.join(WEB, spec.slice(2));
  else if (spec.startsWith('.') && ctx.parentURL?.startsWith('file:')) {
    target = path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec);
  }
  if (!target) return next(spec, ctx);

  const file = resolveFile(target);
  if (!file) return next(spec, ctx);
  const ts = file.endsWith('.ts') || file.endsWith('.tsx');
  return { url: pathToFileURL(file).href, format: ts ? 'module-typescript' : 'module', shortCircuit: true };
}
