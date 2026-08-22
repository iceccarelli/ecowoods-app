import { EW_LOGO, EW_LOGO_SIZE } from '@/lib/brand';
import ogImage from '../app/opengraph-image.jpg';
import { SITE_URL } from '@/lib/seo-data';

/**
 * The two image URLs the entity graph claims, resolved to bytes that exist.
 *
 * WHY THIS FILE EXISTS
 *
 * F-162. `root-schema.ts` declared the organisation's logo and image as:
 *
 *     logoUrl:    `${SITE_URL}/icon-512.png`
 *     ogImageUrl: `${SITE_URL}/og-image.jpg`
 *
 * Fetched from production, both return **404**.
 *
 * `icon-512.png` exists, but only in apps/web/public — the directory this
 * deployment has never served, established by measurement in F-131 and asserted
 * on every run of verify-live.sh. `og-image.jpg` does not exist anywhere in the
 * repository at all.
 *
 * Those are not two decorative fields. `logo` and `image` on the Organization
 * node are what Google reads to attach a brand mark to a Knowledge Panel and to
 * the brand's appearance in search. A logo that 404s is not a smaller logo; it
 * is no logo, on the single most important structured-data object the site
 * emits — and it has been that way for the entire life of the project, while
 * the schema validated perfectly, because a validator checks that a URL is
 * well-formed and never asks whether it resolves.
 *
 * THE FIX IS THE ONE THAT IS ALREADY PROVEN HERE
 *
 * Static imports. Next rewrites these into /_next/static/media/… , which this
 * host does serve — measured at byte level for all 28 diagrams in F-129/F-131,
 * and re-measured on every deploy by verify-live.sh. Importing the file is also
 * what makes the guard possible: a path that does not exist fails the build
 * instead of failing silently in production.
 *
 * The 512×512 source is kept where it is. It does not need to move; it needs to
 * be imported rather than linked. Google's Organization logo guidance asks for
 * at least 112×112, so 512 clears it comfortably; the OG image is 1200×630.
 */
/**
 * F-167. This was the app icon — a favicon, correct but generic. The
 * organisation's logo is the brand mark, published at a stable URL under the
 * repo-root public/ directory. 1024×1024, square, on white: comfortably past
 * Google's 112×112 minimum and the file to hand anyone who asks for the logo.
 */
export const LOGO_URL = `${SITE_URL}${EW_LOGO}`;
export const OG_IMAGE_URL = `${SITE_URL}${ogImage.src}`;

/** Intrinsic dimensions, for schema nodes that accept them. */
export const LOGO_WIDTH = EW_LOGO_SIZE;
export const LOGO_HEIGHT = EW_LOGO_SIZE;
export const OG_IMAGE_WIDTH = ogImage.width;
export const OG_IMAGE_HEIGHT = ogImage.height;
