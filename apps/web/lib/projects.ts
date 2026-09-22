/**
 * lib/projects.ts — the photo-record registry.
 *
 * One import surface for the /projects pages, the /api/v1/media endpoints and
 * the guard. Projects are typed data, not MDX: a photo record has no prose to
 * author, and putting it in the content pipeline would invite the measurement
 * fields it deliberately does not have.
 */
import { MAPLE_VAUGHAN_CURVED_STAIR } from '@/content/projects/maple-vaughan-curved-stair';
import type { Project, ProjectFilm, ProjectStill, ProjectPair, ProjectDetail } from '@/content/projects/maple-vaughan-curved-stair';
import { STONE_COTTAGE_STRIP_REFINISH } from '@/content/projects/stone-cottage-strip-refinish';
import { MAPLE_GLASS_RESIDENCE } from '@/content/projects/maple-glass-residence';

export type { Project, ProjectFilm, ProjectStill, ProjectPair, ProjectDetail };

/* Newest first — a third registered project appears here with no further
   edit anywhere that maps over PROJECTS (the homepage strip, /projects,
   sitemap.ts, llms.txt). */
export const PROJECTS: Project[] = [
  MAPLE_GLASS_RESIDENCE,
  MAPLE_VAUGHAN_CURVED_STAIR,
  STONE_COTTAGE_STRIP_REFINISH,
];

export const getProject = (slug: string): Project | undefined =>
  PROJECTS.find((p) => p.slug === slug);

export const projectSlugs = (): string[] => PROJECTS.map((p) => p.slug);

export const stillById = (project: Project, id: string): ProjectStill | undefined =>
  project.stills.find((s) => s.id === id);

/** Interiors only, in story order — the cards open and close, they do not narrate. */
export const interiors = (project: Project, chapter?: 1 | 2): ProjectStill[] =>
  project.stills
    .filter((s) => s.role === 'interior' && (chapter === undefined || s.chapter === chapter))
    .sort((a, b) => a.chapter - b.chapter || a.order - b.order);

/**
 * Interior stills for a StoryboardHover cover, cover-still first (the same
 * still the site already picks as the KenBurns cover), then the rest of the
 * project's interiors in story order, capped at 8 — motion/tokens.ts'
 * STORYBOARD.maxFrames. A project's photo count label stays the full
 * interior count regardless; this cap is for the hover scrub only.
 */
export const storyboardFramesFor = (
  project: Project,
  cover: ProjectStill,
): { src: string; alt: string }[] => {
  const all = interiors(project);
  const coverIdx = all.findIndex((s) => s.id === cover.id);
  const ordered = coverIdx > 0 ? [all[coverIdx]!, ...all.filter((_, i) => i !== coverIdx)] : all;
  return ordered.slice(0, 8).map((s) => ({ src: s.src, alt: s.alt }));
};

export const chapterCard = (project: Project, chapter: 1 | 2): ProjectStill | undefined =>
  project.stills.find((s) => s.chapter === chapter && s.role === 'card' && s.order === 0);

export const filmFor = (project: Project, chapter: 1 | 2): ProjectFilm | undefined =>
  project.films.find((f) => f.chapter === chapter);
