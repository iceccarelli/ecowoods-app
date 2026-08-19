# Papers — source material and pending exports

Everything a technical paper is built from, and every PDF that is not yet fit to
serve. **Nothing in this folder is published.** `apps/web/public/` is the only
directory Next serves, and it is deliberately not this one.

## What lives here

| | |
|---|---|
| `*.tex` | the LaTeX source a paper's PDF is exported from |
| `*.jpg` | figures the `.tex` includes, by bare filename, so Overleaf compiles with them in this folder |
| `*_explained.md` | the source notes a paper's HTML sections were written from |
| `*.pdf` | an export that is **not yet publishable** — see below |

## Why the PDFs are here and not in `apps/web/public/papers/`

All three supplied exports carry two strings on their title slide:

```
Est. 1998 / 2000
5,200+ Homes
```

Both are on the retired-claims list in `scripts/verify-business-facts.mjs` — the
home count is invented and the founding year is `BUSINESS_NAP.foundedYear`
(2000). They were removed from the entire codebase in the business-facts
remediation, and that guard now reads PDF text as well (F-64), so a PDF carrying
them under `public/` turns the build red on purpose.

`ecowoods-hardwood-refinishing-machines-and-sequence-v1.0-2026-08.tex` is
already corrected — its header explains both edits.

## Publishing a paper's PDF

1. Re-export the `.tex` in Overleaf with the `.jpg` figures in the same folder.
2. `mkdir -p apps/web/public/papers && mv <the-new>.pdf apps/web/public/papers/`
3. `git add apps/web/public/papers` — **commit it in the same step.**

Step 3 is not optional. `apps/web/public/papers/` is untracked until something
is committed into it, and `git clean -fd` in the standard apply chain removes
untracked directories. A `mv` on its own gets wiped by the next run.

The download button and the `associatedMedia` schema node appear automatically —
`pdfIsPublished()` in `apps/web/lib/papers.ts` checks for the file at build time.
No code change.

## A note on the figures

`01_belt_sander.jpg` through `04_buffer.jpg` are AI-generated product renders of
machine *types*, not photographs of EcoWoods' own equipment. They are fine as
illustrations inside a document that names commercial examples generically. They
must never be presented as this shop's machines, and they must never move under
`public/` — that is the same rule that governs `public/images/gbp/` and its
`PLACEHOLDER-NOTICE.md`. Real photographs of the shop's own machines are shots 3
and 4 on `audit/PHOTO_SHOT_LIST.md`.
