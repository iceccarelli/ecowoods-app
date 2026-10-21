/**
 * The site's canonical origin for every absolute link placed in an email.
 *
 * NEXT_PUBLIC_SITE_URL is the site's own canonical origin; NEXTAUTH_URL is only
 * a fallback, since it can be a preview or localhost URL that must never end up
 * in a customer's inbox. Trailing slashes are stripped so `${origin}/path`
 * never produces `//path`.
 *
 * Lives in its own module (no mailer import) so route handlers and server
 * actions can build links without loading the email transport.
 */
export function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL ?? 'https://ecowoods.ca').replace(/\/+$/, '');
}
