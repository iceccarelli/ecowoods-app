/**
 * lib/films.ts — the two delivered film series. Single source of truth.
 *
 * WHAT THIS IS
 *
 * Six first-party mp4s, in two series of three chapters each — the same
 * camera-distance grammar the trilogy stills already use (room, approach,
 * fingertip), shot as motion instead of stills. Every page that mounts a
 * player pulls from here. No one-off `<source src="...">` in a page component.
 *
 * WHY THE SRC IS A PLAIN STRING, NOT A STATIC IMPORT
 *
 * `next/image`'s static-import trick (`StaticImageData`) is for `<Image>`.
 * There is no equivalent for `<video src>` — Next does not run mp4s through
 * an asset pipeline — so a film chapter's `src` is the raw public path,
 * exactly the convention `content/projects/maple-vaughan-curved-stair.ts`
 * already established for this site's other two films. What IS statically
 * imported is each series' `poster`: a real `<Image>`, optimized, blurred
 * placeholder, and the thing FilmStage actually shows before anyone presses
 * play — the same trick ProcessVideo.tsx already uses for its own poster.
 *
 * WHY THE FILES LIVE UNDER apps/web/public/films/, NOT THE REPO ROOT
 *
 * docs/PUBLIC_ASSETS.md: apps/web/public/ is not the Vercel static root, the
 * repo-root public/ is — but vercel.json's buildCommand copies one into the
 * other at build time, specifically so raw-path assets like these keep
 * working locally (`next start` resolves apps/web/public correctly and
 * always did) and in production. This is the exact mechanism the site's other
 * two films (maple-vaughan-curved-stair) already ship on. Nothing here
 * invents a third serving path.
 *
 * ONE ZIP DID NOT BECOME A THIRD SERIES
 *
 * ECOWOODS_FILM_I_THE_ROOM.zip carried its own finished 65-second cut plus a
 * dedicated poster still. Its own shipped notes describe it as "Film I of
 * III" in a *separate*, not-yet-delivered Room/Approach/Fingertip montage
 * built from the trilogy stills — a different project from the six chapters
 * this file registers, despite the name overlap. Only its poster still is
 * reused here (as the-work's poster, per the brief's own explicit fallback
 * list); its own cut was left uncommitted rather than wired into a route
 * nothing asked for.
 */
import type { StaticImageData } from 'next/image';
import { SITE_URL } from './seo-data';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import theWorkPoster from '../public/films/the-work/poster.webp';
import theBriefPoster from '../public/films/the-brief/poster.webp';

export type FilmChapter = {
  id: 1 | 2 | 3;
  src: string;
  title: string;
  caption: string;
  durationLabel: string;
};

export type FilmSlug = 'the-work' | 'the-brief';

export type Film = {
  slug: FilmSlug;
  kicker: string;
  headline: string;
  lede: string;
  poster: StaticImageData;
  chapters: [FilmChapter, FilmChapter, FilmChapter];
  defaultChapter: 1 | 2 | 3;
};

/** Real camera footage of real Ecowoods jobs — see the file header for provenance notes. */
export const FILM_UPLOAD_DATE = '2026-09-19';

export const FILMS: Film[] = [
  {
    slug: 'the-work',
    kicker: 'Three distances.',
    headline: 'The room. The approach. The touch.',
    lede: 'The same floors and stairs, seen standing, then closer, then at the joint.',
    poster: theWorkPoster,
    defaultChapter: 1,
    chapters: [
      {
        id: 1,
        src: '/films/the-work/01-the-work.mp4',
        title: 'The work',
        caption: 'The work — the room as a visitor sees it.',
        durationLabel: '0:33',
      },
      {
        id: 2,
        src: '/films/the-work/02-the-approach.mp4',
        title: 'The approach',
        caption: 'The approach — the camera drops onto the plane.',
        durationLabel: '0:30',
      },
      {
        id: 3,
        src: '/films/the-work/03-the-touch.mp4',
        title: 'The touch',
        caption: 'The touch — grain, nosing, inlay.',
        durationLabel: '0:24',
      },
    ],
  },
  {
    slug: 'the-brief',
    kicker: 'What the shop does.',
    headline: 'Hardwood in Toronto, done once.',
    lede:
      'Installation, refinishing, dust-free sanding, stairs, inlays, commercial floors. Fixed written price. Salaried crews.',
    poster: theBriefPoster,
    defaultChapter: 1,
    chapters: [
      {
        id: 1,
        src: '/films/the-brief/01-the-brief.mp4',
        title: 'The brief',
        caption: 'The brief — the work, the numbers, the number that does not move.',
        durationLabel: '1:08',
      },
      {
        id: 2,
        src: '/films/the-brief/02-the-material.mp4',
        title: 'The material',
        caption: 'The material — oak, maple, parquet, inlay, the finish.',
        durationLabel: '1:14',
      },
      {
        id: 3,
        src: '/films/the-brief/03-the-ascent.mp4',
        title: 'The ascent',
        caption: 'The ascent — the rail a hand finds; the line where tile ends.',
        durationLabel: '1:06',
      },
    ],
  },
];

export const getFilm = (slug: FilmSlug): Film | undefined => FILMS.find((f) => f.slug === slug);

export const chapterOf = (film: Film, id: 1 | 2 | 3): FilmChapter =>
  film.chapters.find((c) => c.id === id) ?? film.chapters[0];

/**
 * VideoObject per chapter — every chapter a FilmStage mounts is reachable
 * from its own tab, not only the one that autoplays first, so all three are
 * described here, the same way a trilogy's ImageObject entries cover all
 * three frames rather than only the rotator's first slide.
 */
export const videoObjectsFor = (film: Film) =>
  film.chapters.map((c) => ({
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: c.title,
    description: c.caption,
    contentUrl: `${SITE_URL}${c.src}`,
    thumbnailUrl: `${SITE_URL}${film.poster.src}`,
    uploadDate: FILM_UPLOAD_DATE,
    publisher: {
      '@type': 'Organization',
      name: BUSINESS_NAP.legalName,
    },
  }));
