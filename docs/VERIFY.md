# `pnpm verify` — what runs, where, and why it is one command

## The measurement that produced this file

On 2026-09-09, on branch `floor-graph`:

| | guards |
|---|---|
| defined in `package.json` (`verify:*`, `seo:*`, excluding network and generators) | **54** |
| run by `pnpm verify` before reaching a failure and stopping | **3** |
| run by the `Guards` job in `.github/workflows/web.yml` | **17** |
| **never run by CI, ever** | **37** |

The 37 were not disabled and nobody decided to skip them. They were added to
`package.json` and the corresponding edit to the workflow was forgotten — an
omission that is invisible, because a step that was never written cannot show up
as missing in a green checks list.

One of the 37 was `verify:destinations`. At the moment of the measurement it was
failing, correctly, on a real defect: `/hardwood-stairs-toronto` linked to
`/projects/maple-vaughan-curved-stair`, and `/projects` had no manifest entry, so
the guard could not prove the link resolved. That link had already shipped to
production. Two independent mechanisms should have caught it before the push, and
neither did:

* **Local.** `pnpm verify` was a 57-link `&&` chain. `verify:hygiene` failed at
  link 3, the chain stopped, and links 4–57 — including `verify:destinations` at
  19 — never ran. A chain can only ever report one failure, which reads like you
  are one fix from green.
* **CI.** The guard was not in the workflow.

And the chain's failure was invisible for a third reason: it printed its error
and exited, and then the next pasted command printed four hundred lines of green
build output on top of it. Twice in one week a red `pnpm verify` was followed by
a commit and a push, because by the time the screen stopped scrolling everything
visible said ✓.

## What changed

`pnpm verify` is now `node scripts/verify-all.mjs`, which:

1. **Derives the run set from `package.json`.** Every `verify:*` and `seo:*`
   script whose command is a single `node scripts/*.mjs` is run.
   Nothing lists the guards a second time, so nothing can fall out of the list.
2. **Refuses to run if a script is neither run nor skipped.** A guard that does
   not fit the shape must be added to `SKIP` with a stated reason. An
   unexplained exclusion is how a guard stops running without anyone choosing it.
3. **Runs all of them, in parallel, and does not stop at the first failure.**
   57 guards in about 3 seconds, against roughly 60–90 for the old chain of
   `pnpm` invocations.
4. **Prints the failures last, in full.** The final thing on the screen is the
   list of what failed and the complete output of each — no scrolling back into
   a buffer that may not reach.

`.github/workflows/web.yml` keeps its individually named steps, because a step
name in the PR checks list says what broke before you open a log, and adds one
final step that runs the whole set. The named steps re-run inside it. That costs
about six seconds and buys the guarantee that CI and a developer's machine can
never again disagree about which guards exist.

## Adding a guard

Add the `package.json` entry. That is the whole procedure:

```json
"verify:thing": "node scripts/verify-thing.mjs"
```

It is in `pnpm verify` and in CI from that commit. Add a named CI step as well
only if the guard is one whose failure you want to read off the checks list
without opening a log.

## Running it

```bash
pnpm verify                        # all of them, parallel, ~3s
node scripts/verify-all.mjs --list # what runs, and what is skipped and why
node scripts/verify-all.mjs --serial
node scripts/verify-thing.mjs      # one guard, full output, as always
```

The skipped scripts are the ones that reach the network (`verify:live`,
`verify:live-routes`, `verify:live-images`, `seo:crawl`), the generators
(`seo:prompts`), the composites, and `seo:audit`, which is a report and always
exits 0. The network half runs after a deploy, from a machine with open
egress.
