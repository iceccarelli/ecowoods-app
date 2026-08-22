/**
 * The Ecowoods brand mark.
 *
 * WHY THIS IS A URL AND NOT A DATA URI
 *
 * F-167. This file used to export the mark as a 14,545-character base64
 * `data:image/png` string. Two consequences, and the second is the expensive one.
 *
 * It was shipped inside the HTML of every single page — 14.5 KB of base64 on
 * every response, uncacheable, re-sent to every visitor on every navigation,
 * ahead of the content in the byte stream.
 *
 * And a data URI **is not an image on the web.** It has no URL. It cannot be
 * crawled, indexed, linked, shared, or fetched. Google Images could not find
 * this company's logo because, as far as the internet was concerned, the logo
 * did not exist — it was a string inside a document. The `<img>` rendering it
 * also carried `alt=""` and sat inside `aria-hidden="true"`, so the one crawler
 * that did parse the tag was explicitly told to ignore it.
 *
 * The mark now lives at a stable, human-readable URL under the REPO-ROOT
 * public/ directory — which is served, measured, not assumed: /qr-app.jpg has
 * always returned 200 from there while apps/web/public has always returned 404
 * (F-131). A stable path matters more than a hashed one here, because a logo is
 * the asset other people link to: press, profiles, directories, and Google's
 * own Organization logo field.
 *
 * The bytes are unchanged. ew-mark-192.png is exactly what the data URI decoded
 * to, so nothing about the rendered page moves.
 */

/** The header mark. 192×192, the exact bytes that used to be inlined here. */
export const EW_MARK = '/brand/ew-mark-192.png';

/** Intrinsic size of EW_MARK, so the <img> can reserve its space and not shift. */
export const EW_MARK_SIZE = 192;

/**
 * The 1024×1024 master, on white. This is the Organization logo: Google asks
 * for at least 112×112 and prefers a clean square, and it is the file to hand
 * anyone who asks for "the logo".
 */
export const EW_LOGO = '/brand/ew-mark.png';
export const EW_LOGO_SIZE = 1024;

/** The portrait lockup, published so it has an address. Not used in the UI. */
export const EW_LOGO_PORTRAIT = '/brand/ecowoods-logo-ew.jpg';

/** Alt text. The mark is the company's name — that is what it must say. */
export const EW_MARK_ALT = 'Ecowoods — the EW monogram, the company logo';
