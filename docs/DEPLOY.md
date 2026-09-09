# One branch, one truth

## What went wrong, so that nobody rebuilds it

On 2026-09-09 the live site was serving a build two features old. `/quote-check`
had been live and confirmed 200; hours later it returned 404 to every visitor
and every crawler. Nothing was wrong with the code:

- `pnpm build` reported 331 pages
- 61 guards passed
- 256 tests passed
- `vercel --prod` reported `✓ Ready` and `▲ Aliased https://ecowoods.ca`

`vercel inspect ecowoods.ca` named a deployment whose alias list included
`ecowoods-app-git-main-…` — a Git-integration build from `main`. The project's
production branch was `main`; the work was on `floor-graph`; and patches were
being uploaded to `main` through the GitHub web UI. So every patch upload
triggered a production build of a branch that did not contain the site, and it
took the alias back within minutes of each CLI deploy. Re-pointing the alias by
hand held for four minutes.

Three separate practices had to be true at once for this to happen, and each was
individually reasonable:

1. production deployed from `main`
2. the actual site lived on a long-running branch that had never been merged
3. `main` was being used as a file drop for patch delivery

## The rules

**One branch is the site.** `main`. It is what production deploys, what the PR
checks run against, and what anybody reading the repository sees. A long-running
branch that carries the real site while `main` carries something else is the
condition that made the above possible — and it lasted a week because everything
each half of it reported was true.

**Production deploys from `main`, through the Git integration.** Not from a
laptop. A CLI deploy is a deployment nothing else knows about: it does not
appear in a PR, it cannot be reviewed, and it loses a race with the integration
without either side reporting a conflict. `vercel --prod` is for a deliberate
out-of-band deploy, and after one, `pnpm verify:live-routes` is not optional.

**Nothing is pushed to `main` except a merged pull request.** The pre-commit
hook already refuses a commit on `main` (F-152). The remaining hole is the web
UI, which the hook cannot see. Which is why:

**Patches are uploaded to the `patches` branch.** It is an orphan branch that
nothing merges and nothing deploys. A `.patch` file on `main` is a file on the
production branch: it triggers a production build, and it lands at the
repository root of every PR merge commit, where `verify:hygiene` fails it.

```bash
# apply a patch that was uploaded to `patches`
git fetch origin
git show origin/patches:ECOWOODS_XX_01_name.patch | git apply --whitespace=error-all --check - \
  && git show origin/patches:ECOWOODS_XX_01_name.patch | git apply --whitespace=error-all -
```

## After every deploy

```bash
pnpm verify:live         # the sample: pages, machine surfaces, images, canonicals
pnpm verify:live-routes  # every route this repository defines, fetched
```

`verify:live-routes` is the one that would have caught this on the first
afternoon. It walks `apps/web/app` for pages and route handlers, expands each
dynamic segment from the same manifests that generate it, adds every endpoint in
the API manifest, and fetches all of them. A route that exists here and 404s
there means the deployment serving the site is not the code you built — and it
names which routes, which is the difference between "something is wrong" and a
diagnosis.

```bash
pnpm verify:live-routes --all    # every slug, not one per dynamic route
node scripts/verify-live-routes.mjs --list   # what it would fetch, no network
```

Neither is in `pnpm verify`: both reach the network, and a guard that reports a
proxy's 403 as a broken site is a guard people learn to ignore.

## Diagnosing a suspected rollback

```bash
vercel inspect ecowoods.ca                       # which deployment owns the alias
curl -sI https://ecowoods.ca/<route> | grep -i x-vercel-id
vercel ls ecowoods-app --prod                    # what has been deploying, and from where
```

An alias whose deployment lists `…-git-<branch>-…` was produced by the Git
integration from that branch. If that branch is not the branch you are working
on, that is the whole answer.
