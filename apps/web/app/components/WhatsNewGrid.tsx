import Link from 'next/link';
import { getChangelog } from '@/lib/changelog';

/**
 * WhatsNewGrid — the AWS "What's new" card row.
 *
 * WHY THIS EARNS ITS PLACE
 *
 * aws.amazon.com gives its second screen to three cards: a category chip, an
 * image, a headline, two lines, an arrow. It is the highest-value block on the
 * page because it answers a question every serious buyer asks silently — is
 * anyone still working on this?
 *
 * This site already has the data. lib/changelog.ts holds twenty-eight written
 * entries, each with a date, a kind and a sentence saying why it matters, and
 * a guard that FAILS THE BUILD if a paper, guide or figure ships without one.
 * All of it was reachable from exactly one place: /whats-new, linked from the
 * footer. A publication record that nobody sees is a publication record that
 * does no work.
 *
 * Three cards, newest first, on the surfaces where a visitor is deciding
 * whether this company is serious. The category chip is the `kind` the manifest
 * already carries; no new content is authored here, which is the same rule that
 * governs the markdown export and the knowledge API.
 */
const KIND_LABEL: Record<string, string> = {
  paper: 'Technical paper',
  guide: 'Guide',
  figure: 'Figure',
  framework: 'Framework',
  tool: 'Tool',
  data: 'Data',
};

const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });

export function WhatsNewGrid({
  limit = 3,
  heading = "What's new",
  intro = 'What was published here most recently, and why it matters. Every technical paper, guide and figure on this site has an entry — the build fails without one.',
}: {
  limit?: number;
  heading?: string;
  intro?: string;
}) {
  const entries = getChangelog().slice(0, limit);
  if (!entries.length) return null;

  return (
    <section className="wn" aria-label={heading}>
      <div className="shell">
        <h2 className="wn-h">{heading}</h2>
        <p className="wn-intro">{intro}</p>
        <ul className="wn-grid">
          {entries.map((e) => (
            <li className="wn-card" key={e.id}>
              <Link href={e.href} className="wn-card-link">
                <span className="wn-chip">{KIND_LABEL[e.kind] ?? e.kind}</span>
                <h3 className="wn-card-h">{e.title}</h3>
                <p className="wn-card-body">{e.body}</p>
                <span className="wn-card-foot">
                  <time dateTime={e.date}>{fmt(e.date)}</time>
                  <span className="wn-arrow" aria-hidden="true">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link className="wn-all" href="/whats-new">
          Everything published here <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
