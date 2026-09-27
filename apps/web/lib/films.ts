/**
 * lib/films.ts — the three delivered film series. Single source of truth.
 *
 * WHAT THIS IS
 *
 * Nine first-party mp4s, in three series of three chapters each. The first
 * two (the-work, the-brief) use the same camera-distance grammar the
 * trilogy stills already use (room, approach, fingertip), shot as motion
 * instead of stills. Every page that mounts a player pulls from here. No
 * one-off `<source src="...">` in a page component.
 *
 * THE THIRD SERIES IS NOT CAMERA FOOTAGE — SAY SO
 *
 * the-work and the-brief are real camera footage of real Ecowoods jobs.
 * the-how is not: it is a first-party animated explainer trilogy (illustrated,
 * narrated, captioned) answering the objections that stall a booking — dust,
 * living in the house during work, and what separates a spec-led process from
 * a commodity quote. Nothing about it claims to document a real job, and
 * nothing in this file or the pages that mount it is allowed to imply it
 * does: no `kind:photograph`, no "on site" framing borrowed from the other
 * two series. Each film's own `uploadDate` records when it actually went up,
 * which is also why that is a per-film field and not the single shared
 * constant this file used to export.
 *
 * KNOWN OPEN DEFECT — HUMAN BLOCKER, NOT FIXABLE FROM HERE
 *
 * The three the-how source mp4s under apps/web/public/films/the-how/ carry a
 * "Gemini Notebook" watermark baked into every frame, plus burned-in caption
 * cards — both are pixels in the delivered video files, not something a page
 * component or this registry can crop or hide. Only the poster still was
 * cropped clean. Fix: replace the three files in that directory with clean
 * re-exports at the same paths — verify-films.mjs will keep passing as long
 * as the replacements are non-empty and correctly named; it cannot detect
 * the watermark itself.
 *
 * WHY THE SRC IS A PLAIN STRING, NOT A STATIC IMPORT
 *
 * `next/image`'s static-import trick (`StaticImageData`) is for `<Image>`.
 * There is no equivalent for `<video src>` — Next does not run mp4s through
 * an asset pipeline — so a film chapter's `src` is the raw public path,
 * exactly the convention `content/projects/maple-vaughan-curved-stair.ts`
 * already established for this site's other films. What IS statically
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
 * films (maple-vaughan-curved-stair) already ship on. Root is not a valid
 * film home — the-how's three source files arrived at the repo root and were
 * moved here for exactly that reason. Nothing here invents a third serving
 * path.
 *
 * ONE ZIP DID NOT BECOME A FOURTH SERIES
 *
 * ECOWOODS_FILM_I_THE_ROOM.zip carried its own finished 65-second cut plus a
 * dedicated poster still. Its own shipped notes describe it as "Film I of
 * III" in a *separate*, not-yet-delivered Room/Approach/Fingertip montage
 * built from the trilogy stills — a different project from the chapters this
 * file registers, despite the name overlap. Only its poster still is reused
 * here (as the-work's poster, per the brief's own explicit fallback list);
 * its own cut was left uncommitted rather than wired into a route nothing
 * asked for.
 */
import type { StaticImageData } from 'next/image';
import { SITE_URL } from './seo-data';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import theWorkPoster from '../public/films/the-work/poster.webp';
import theBriefPoster from '../public/films/the-brief/poster.webp';
import theHowPoster from '../public/films/the-how/poster.webp';
import thePriceMenuPoster from '../public/films/the-price-menu/poster.webp';
import theVisionPoster from '../public/films/the-vision/poster.webp';
import seeItPoster from '../public/films/see-it/poster.webp';

export type FilmChapter = {
  id: number;
  src: string;
  title: string;
  caption: string;
  durationLabel: string;
  /** Set only when a chapter shipped after the rest of its film — the-how's
   *  chapters 4 and 5 arrived two weeks after 1-3, so they carry their own
   *  date instead of inheriting the film's. Falls back to `Film.uploadDate`
   *  in videoObjectsFor when absent. */
  uploadDate?: string;
};

export type FilmSlug = 'the-work' | 'the-brief' | 'the-how' | 'the-price-menu' | 'the-vision' | 'see-it';

export type Film = {
  slug: FilmSlug;
  kicker: string;
  headline: string;
  lede: string;
  poster: StaticImageData;
  /** One to N chapters sharing one <video> element — not every series is a
   *  three-part trilogy. the-work/the-brief ship exactly 3; the-how now
   *  ships 5; the-vision and see-it ship 1 each. */
  chapters: FilmChapter[];
  defaultChapter: number;
  /** The date this series actually went up — per film, not shared, because
   *  the-how did not ship the same day as the-work and the-brief. */
  uploadDate: string;
  /** Video frame shape: 'landscape' (16:9 camera footage) or 'portrait'
   *  (9:16 AI-animated). FilmStage uses this — not the poster's own aspect
   *  ratio, which is a separate authored crop — to decide whether the
   *  mounted <video> needs object-fit:contain letterboxing instead of the
   *  default stretch-to-fill 16:9 box. */
  frame: 'landscape' | 'portrait';
};

/** the-how went up separately from the-work/the-brief — see the file header. */
const FILM_HOW_UPLOAD_DATE = '2026-09-21';

/** the-how's chapters 4-5, the-price-menu, the-vision, see-it and the
 *  pricing-logic audio track all shipped together in the same media drop. */
const FILM_HOW_CHAPTER_4_5_UPLOAD_DATE = '2026-09-27';

export const FILMS: Film[] = [
  {
    slug: 'the-work',
    kicker: 'Three distances.',
    headline: 'The room. The approach. The touch.',
    lede: 'The same floors and stairs, seen standing, then closer, then at the joint.',
    poster: theWorkPoster,
    defaultChapter: 1,
    uploadDate: '2026-09-19',
    frame: 'landscape',
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
    uploadDate: '2026-09-19',
    frame: 'landscape',
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
  {
    slug: 'the-how',
    kicker: 'The objections, answered.',
    headline: 'Dust. Living at home. The quote.',
    lede: 'Three short answers to the three questions that actually stall a booking.',
    poster: theHowPoster,
    defaultChapter: 1,
    uploadDate: FILM_HOW_UPLOAD_DATE,
    frame: 'portrait',
    chapters: [
      {
        id: 1,
        src: '/films/the-how/01-how-dust-free-floor-sanding-works.mp4',
        title: 'How dust-free sanding works',
        caption: 'HEPA extraction at the tool, a sealed barrier at the room.',
        durationLabel: '1:05',
      },
      {
        id: 2,
        src: '/films/the-how/02-how-to-refinish-floors-without-moving-out.mp4',
        title: 'Refinish without moving out',
        caption: 'What has to be true on site for the house to stay livable during the work.',
        durationLabel: '1:18',
      },
      {
        id: 3,
        src: '/films/the-how/03-four-tech-trends-rewriting-hardwood-flooring.mp4',
        title: 'Four tech trends rewriting the rules',
        caption: 'Why a specified process beats a commodity quote.',
        durationLabel: '1:12',
      },
      {
        id: 4,
        src: '/films/the-how/04-what-a-typical-quote-hides.mp4',
        title: 'What a typical quote hides',
        caption:
          'Demolition, an "unforeseen" subfloor repair, upgraded materials — the line items that turn one number into three.',
        durationLabel: '1:25',
        uploadDate: FILM_HOW_CHAPTER_4_5_UPLOAD_DATE,
      },
      {
        id: 5,
        src: '/films/the-how/05-how-one-toronto-company-fixed-it.mp4',
        title: 'How one Toronto company fixed it',
        caption: 'Why a specified, published process is the alternative to a number that grows once the floor is open.',
        durationLabel: '1:18',
        uploadDate: FILM_HOW_CHAPTER_4_5_UPLOAD_DATE,
      },
    ],
  },
  {
    slug: 'the-price-menu',
    kicker: 'The menu, published.',
    headline: 'Why pricing feels mysterious — and the menu that isn’t.',
    lede:
      'Two short explainers: what makes renovation pricing opaque elsewhere, and the six-line menu this shop publishes instead.',
    poster: thePriceMenuPoster,
    defaultChapter: 1,
    uploadDate: FILM_HOW_CHAPTER_4_5_UPLOAD_DATE,
    frame: 'landscape',
    chapters: [
      {
        id: 1,
        src: '/films/the-price-menu/01-why-pricing-feels-mysterious.mp4',
        title: 'Why pricing feels mysterious',
        caption: 'Renovation pricing looks arbitrary from the outside. The six published bands are how this shop makes it not.',
        durationLabel: '7:04',
      },
      {
        id: 2,
        src: '/films/the-price-menu/02-the-ecowoods-process.mp4',
        title: 'The Ecowoods process',
        caption: 'Measure, checklist, contract, install — the sequence behind the published number, and why it runs on salaried crews rather than subcontractors.',
        durationLabel: '7:00',
      },
    ],
  },
  {
    slug: 'the-vision',
    kicker: 'One system, shown whole.',
    headline: 'The floor is no longer imagined.',
    lede: 'Floor Studio, the published bands, and the Ask Francisco project workspace — the three tools this company built, in one 90-second tour.',
    poster: theVisionPoster,
    defaultChapter: 1,
    uploadDate: FILM_HOW_CHAPTER_4_5_UPLOAD_DATE,
    frame: 'landscape',
    chapters: [
      {
        id: 1,
        src: '/films/the-vision/01-the-floor-is-no-longer-imagined.mp4',
        title: 'The floor is no longer imagined',
        caption: 'A floor rendered into a real room, the published bands behind the estimate, and a conversation turned into a project workspace.',
        durationLabel: '1:30',
      },
    ],
  },
  {
    slug: 'see-it',
    kicker: 'The decision, seen.',
    headline: 'See it before you decide.',
    lede: 'A homeowner weighing whether to refinish, with the floor she is standing on rendered live instead of imagined.',
    poster: seeItPoster,
    defaultChapter: 1,
    uploadDate: FILM_HOW_CHAPTER_4_5_UPLOAD_DATE,
    frame: 'landscape',
    chapters: [
      {
        id: 1,
        src: '/films/see-it/01-see-it.mp4',
        title: 'See it',
        caption: 'The refinish question, and the Floor Designer overlay that answers it without a sample board on the floor.',
        durationLabel: '1:18',
      },
    ],
  },
];

/**
 * AUDIO — Fixed_price_flooring_through_software_logic.m4a. Not a film: no
 * frame, no poster-then-play affordance. A single 38-minute first-party
 * audio track, presented as audio because that is what the file is — see
 * the file's own header for why it is never rendered inside a <video>.
 */
export type AudioTrack = {
  slug: 'pricing-logic';
  kicker: string;
  headline: string;
  lede: string;
  src: string;
  title: string;
  caption: string;
  durationLabel: string;
  uploadDate: string;
};

export const AUDIO_TRACKS: AudioTrack[] = [
  {
    slug: 'pricing-logic',
    kicker: 'Long-form.',
    headline: 'Fixed-price flooring, through the software logic.',
    lede: 'The long-form companion to the Transparent Pricing Menu film — how the published bands are set, and held.',
    src: '/films/pricing-logic/01-fixed-price-flooring-through-software-logic.m4a',
    title: 'Fixed-price flooring through software logic',
    caption: 'A 38-minute audio piece on the reasoning behind the published price bands.',
    durationLabel: '38:28',
    uploadDate: FILM_HOW_CHAPTER_4_5_UPLOAD_DATE,
  },
];

export const getFilm = (slug: FilmSlug): Film | undefined => FILMS.find((f) => f.slug === slug);

export const chapterOf = (film: Film, id: number): FilmChapter =>
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
    uploadDate: c.uploadDate ?? film.uploadDate,
    publisher: {
      '@type': 'Organization',
      name: BUSINESS_NAP.legalName,
    },
  }));

/** AudioObject for the pricing-logic track — the audio counterpart of
 *  videoObjectsFor, kept separate because an AudioTrack has no poster. */
export const audioObjectFor = (track: AudioTrack) => ({
  '@context': 'https://schema.org',
  '@type': 'AudioObject',
  name: track.title,
  description: track.caption,
  contentUrl: `${SITE_URL}${track.src}`,
  uploadDate: track.uploadDate,
  publisher: {
    '@type': 'Organization',
    name: BUSINESS_NAP.legalName,
  },
});
