# public/illustrations

Drop the generated files here. One file per manifest entry, named exactly
`<id>.webp` — the id is in `apps/web/lib/images.ts` and `verify-images.mjs`
fails the build on any file here that no entry points at.

    pnpm images:brief          print every prompt, id, size and alt text
    pnpm verify:images         check the set

Sizes: **1600×900** for everything except the five `og-*` cards, which are
**1200×630**.

Until a file arrives its slot renders a dashed placeholder at the exact final
aspect ratio, so nothing on the page moves when you upload it. Add files in any
order; there is no need to do them all at once.

**The one rule:** every image here is a diagram or an illustration. Nothing
generated may be presented as a photograph of Ecowoods work — that is enforced
by the guard, and it is the same rule as never publishing a moisture reading
nobody took. Photographs of real jobs are a separate shoot; see
`audit/PHOTO_SHOT_LIST.md`.
