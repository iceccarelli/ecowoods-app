#!/usr/bin/env node
/**
 * scripts/render-api-test.mjs — run the render API's tests, or say why not.
 *
 * WHY THIS FILE EXISTS INSTEAD OF TWO NODE COMMANDS IN package.json
 *
 * The service is TypeScript that Node strips at load time, which needs
 * `--experimental-strip-types`. That landed in Node 22.6. This repository's
 * devcontainer pins `node:20-bookworm`, where the flag does not exist, and Node
 * answers a flag it does not know with:
 *
 *     node: bad option: --experimental-strip-types
 *
 * — which says nothing about versions and sends you looking for a typo. The
 * root script that produced that message was added by me after verifying it on
 * a Node 22 machine and not checking what the repository declares. This runner
 * is plain JavaScript, so it starts on any Node, checks the version first, and
 * explains the one thing that is actually wrong.
 *
 * WHAT IS AND IS NOT BROKEN BY THIS
 *
 * Production is fine: services/render-api/Dockerfile pins node:24-slim, so the
 * image this deploys from has had the feature for two major versions. Nothing
 * on the website touches it — the 66 guards, parse-scan and the Next build are
 * all plain JavaScript or run through Next's own compiler. What cannot happen
 * on Node 20 is running or testing this service locally, which is a real gap
 * and is the whole of the gap.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REQUIRED = [22, 6];

const [major, minor] = process.versions.node.split('.').map(Number);
const tooOld = major < REQUIRED[0] || (major === REQUIRED[0] && minor < REQUIRED[1]);

if (tooOld) {
  console.error(`
The render API is TypeScript that Node strips at load time, which needs
--experimental-strip-types. That arrived in Node ${REQUIRED.join('.')}.

  this shell is running   Node ${process.versions.node}
  the service needs       Node ${REQUIRED.join('.')} or newer
  .devcontainer pins      node:20-bookworm
  the deployed image is   node:24-slim   (so production is unaffected)

Two ways forward, and the choice is not this script's to make:

  · Run it in the image it deploys from, which needs nothing installed:
      docker run --rm -v "$PWD":/app -w /app node:24-slim \\
        node --experimental-strip-types scripts/render-api-test.mjs

  · Or raise the devcontainer to node:22-bookworm and rebuild it. That is a
    change to everyone's environment, including anything else working in this
    repository, so it wants to be a decision rather than a side effect.
`);
  process.exit(1);
}

const run = (args) =>
  spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' }).status ?? 1;

const failed =
  run(['--experimental-strip-types', 'services/render-api/src/keys.test.ts']) ||
  run([
    '--experimental-strip-types',
    '--import',
    './services/render-api/src/register.mjs',
    'services/render-api/src/plate.test.ts',
  ]);

process.exit(failed ? 1 : 0);
