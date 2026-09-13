# Where things belong

Measured on `c5413bc`, not remembered. Every count in this file came from the
repository, and the method is stated so it can be re-run.

## What ships

One application. `apps/web` is the whole of ecowoods.ca: 261 indexed URLs, 67
API routes, and every machine surface. Both `vercel.json` files build only it —
the root one runs `turbo build --filter=@ecowoods/web`, the other `cd apps/web`.

| Package | Source files | Files importing it | Status |
|---|---:|---:|---|
| `@ecowoods/shared` | flat (`index.ts`, `ai/`, `constants/`, `schemas/`, `theme/`, `types/`) | **101** | Load-bearing |
| `@ecowoods/types` | 1 | 6 | Used by mobile and `packages/ui` |
| `@ecowoods/api-client` | 3 | 5 | Used by web and mobile |
| `@ecowoods/ui` | 6 | **0** | No code imports it, anywhere |
| `@ecowoods/auth` | 2 | **0** | `apps/web/lib/auth.ts` does this job instead |
| `@ecowoods/config` | 1 | **0** | Orphan |
| `@ecowoods/utils` | **0** | **0** | Has no source directory at all — only a `package.json` |

Method: `grep -rl "@ecowoods/<pkg>" apps packages --include=*.ts --include=*.tsx`,
excluding the package's own directory. JSON manifests excluded, because a
dependency entry is not an import.

## What does not ship, and is still in the tree

- **`backend/`** — a Python/FastAPI/SQLite project with its own Alembic
  migrations and pytest suite. Not in `pnpm-workspace.yaml`, not built by
  turbo, not deployed by either `vercel.json`, and sharing no code with
  `apps/web`. It is a third codebase living in the same repository.
- **`apps/admin/`** — four static HTML/CSS/JS files. No `package.json`, so not
  a workspace member; nothing builds or serves it. The live admin is
  `apps/web/app/admin/*`.
- **`apps/mobile/frontend/`** — a second, older React Native app sitting beside
  the current Expo Router app in `apps/mobile/app/`, with its own
  `package.json` and `eas.json`.

None of these is deleted here. Deleting somebody's Python backend or their
older mobile app on the strength of "nothing imports it" is a decision for the
person who wrote it, not a tidiness patch. They are written down so the choice
is deliberate rather than forgotten.

## Fixed by HYG-03

**`.env.example` described a different application.** It listed
`POSTGRES_USER`, `POSTGRES_PASSWORD`, `API_PORT`, `SECRET_KEY`, `DEBUG` and
`CORS_ORIGINS` — every one of them belonging to `backend/`, none read anywhere
in `apps/web` or `packages/*`. The forty-one variables the real application
reads were documented nowhere.

The one file whose entire job is telling a new contributor what to configure
was pointing at the wrong system. It now lists every variable extracted from
the source, grouped by what breaks without it.

**Four `tsconfig` path aliases pointed at packages nothing imports**, two of
them at directories that do not exist (`packages/utils/src`,
`packages/config/src` has one file). Removed. Zero importers means zero
resolution change, and a path alias to a directory that is not there is a
statement the compiler silently ignores.

## Known, measured, and deliberately not changed

**`apps/web/tsconfig.json` maps `@ecowoods/shared` to
`../../packages/shared/src`. That directory does not exist** — the package is
flat. The 101 import sites work because TypeScript falls through to the
workspace link in `node_modules`.

So the alias is inert. Correcting it would change how 101 imports resolve, and
this sandbox cannot run a production build to prove the new resolution is
identical. A config change that looks tidy and quietly alters module resolution
for a hundred files is the kind that is discovered in production. It is left
alone, and written down here.

**`@ecowoods/ui` and `@ecowoods/auth` remain in `apps/web/package.json`.** They
are unused, and removing them edits the dependency graph, which makes
`pnpm-lock.yaml` stale. `scripts/ship.sh` runs a plain `pnpm install` that
currently reports "Lockfile is up to date, resolution step is skipped". Costing
a deploy cycle over two unused symlinks is a bad trade. Done properly, locally:

    pnpm --filter @ecowoods/web remove @ecowoods/ui @ecowoods/auth
    git add apps/web/package.json pnpm-lock.yaml

## A guard was considered and not written

A `verify:workspace` check — fail when a workspace package has zero importers,
or when a `tsconfig` path points at a directory that does not exist — would
keep this true without anybody re-reading it.

It is not in this patch, deliberately. The standing instruction on this
repository is not to add guards that stand between a contributor and their
work, and this one would fire on a package the moment it is created and before
it is wired up. The structure is documented instead. If that proves not to hold,
a guard is the answer and this paragraph is the argument for it.
