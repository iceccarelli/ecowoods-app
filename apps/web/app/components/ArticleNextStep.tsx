import Link from 'next/link';

/**
 * The way out of a blog article or case study toward the thing the business
 * sells. These eleven pages (six articles, five case studies) linked only to
 * each other: a reader who had just understood a subfloor problem had no path
 * to /estimate or to a service page.
 *
 * It names no particular service on purpose. Which service an article bears on
 * is a judgement that lib/authority-routes.ts makes per source paper, and a
 * wrong guess sends a refinishing question to an installation page; the generic
 * block is correct for every page and the full service list is one click away.
 */
export function ArticleNextStep() {
  return (
    <aside className="tlx-about" aria-label="Next step">
      <h3>Planning hardwood work in Toronto or the GTA?</h3>
      <p>
        <Link href="/estimate">Get a fixed written price</Link> after an in-home measure, or see{' '}
        <Link href="/services">every hardwood flooring service we provide</Link>.
      </p>
    </aside>
  );
}
