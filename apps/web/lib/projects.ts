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

export const chapterCard = (project: Project, chapter: 1 | 2): ProjectStill | undefined =>
  project.stills.find((s) => s.chapter === chapter && s.role === 'card' && s.order === 0);

export const filmFor = (project: Project, chapter: 1 | 2): ProjectFilm | undefined =>
  project.films.find((f) => f.chapter === chapter);
