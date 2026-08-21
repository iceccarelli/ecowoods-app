import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getImages, IMAGE_DIR } from '@/lib/images';
import { illustrationImage } from '../data/illustration-images';
import { floors, floorImages } from '../data/floors';
import { machines, machineImages } from '../data/machines';
import { RotatingTile } from '../components/RotatingTile';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

/**
 * /library — every image this site has, in one place, organised.
 *
 * 136 images: 28 technical diagrams, 36 floor photographs, 72 machine
 * photographs. Before this page all of them were locked inside two homepage
 * components or a single deep route each. Nothing listed them and a visitor who
 * thinks visually had no way in.
 *
 * TWO KINDS OF IMAGE, TWO TREATMENTS — this is the whole design.
 *
 * The photographs rotate, with Ken Burns, staggered, four variants. That is
 * what photography is for here: atmosphere, and evidence of the work.
 *
 * The diagrams do not move at all. Someone reading the substrate cross-section
 * is tracing a fastener from a board into a joist, and a frame scaling under
 * them makes that harder. Motion on an explanatory diagram spends comprehension
 * to buy atmosphere the diagram does not need.
 *
 * Every diagram tile is a LINK to the page that explains it. That is what makes
 * this an index rather than a gallery — a visitor arrives at a picture of
 * cupping and leaves at the definition of cupping.
 */

export const metadata: Metadata = {
  title: 'Visual Library',
  description:
    'Every diagram and photograph on this site in one index: 28 technical cross-sections explaining moisture, substrate, movement and the refinishing sequence, plus the floor collection and the machines that produce it.',
  alternates: { canonical: '/library' },
  openGraph: {
    title: 'Visual Library — EcoWoods',
    description:
      'Technical cross-sections, the floor collection, and the machines — every image indexed and linked to what explains it.',
    type: 'website',
    url: `${SITE_URL}/library`,
    images: [{ url: illustrationImage('og-glossary')?.src ?? '/illustrations/og-glossary.webp', width: 1200, height: 630 }],
  },
};

const GROUPS = [
  { key: 'pillar-', title: 'The six framework pillars', note: 'What each pillar of the Well-Installed Framework is protecting against.' },
  { key: 'failure-', title: 'Failure modes', note: 'What a floor looks like when a step was skipped — permanent, visible records of process failure.' },
  { key: 'concept-', title: 'Core concepts', note: 'The ideas every other page on this site depends on.' },
  { key: 'paper-', title: 'The technical papers', note: 'One hero diagram per published paper.' },
  { key: 'guide-', title: 'Guides and reference installations', note: 'The decision, or the assembly, drawn end to end.' },
];

export default function LibraryPage() {
  const diagrams = getImages().filter((i) => !i.id.startsWith('og-'));
  const photos = floors.length * 3 + machines.length * 6;

  return (
    <div className="tlx-page">
      {/* ImageObject, not TechArticle. buildWebPageSchema models dated written
          works and requires a datePublished; a cross-section is neither an
          article nor dated. ImageObject carries what actually matters about a
          diagram to a machine — its caption, its alt text, its real pixel size,
          and the page that explains it. */}
      <SchemaScript
        schema={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          '@id': `${SITE_URL}/library#collection`,
          name: 'Visual Library — EcoWoods',
          description: 'Every technical diagram and photograph on this site, indexed.',
          url: `${SITE_URL}/library`,
          isPartOf: { '@id': `${SITE_URL}/#website` },
          publisher: { '@id': `${SITE_URL}/#organization` },
          license: 'https://creativecommons.org/licenses/by/4.0/',
          hasPart: diagrams.map((d) => ({
            '@type': 'ImageObject',
            '@id': `${SITE_URL}${IMAGE_DIR}/${d.file}`,
            contentUrl: `${SITE_URL}${IMAGE_DIR}/${d.file}`,
            name: d.caption ?? d.alt,
            caption: d.alt,
            width: d.width,
            height: d.height,
            encodingFormat: 'image/webp',
            isAccessibleForFree: true,
            ...(d.href ? { mainEntityOfPage: `${SITE_URL}${d.href}` } : {}),
          })),
        }}
      />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Visual Library', url: `${SITE_URL}/library` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>Visual Library</span>
          </nav>
          <h1 className="tlx-title">Visual library</h1>
          <p className="tlx-lede">
            Every image on this site, indexed. {diagrams.length} technical cross-sections — each one
            a link to the page that explains it — then the floor collection and the machines that
            produce it.
          </p>
          <p className="fw-meta">
            <span>{diagrams.length + photos} images</span>
            <span aria-hidden="true">·</span>
            <span>{diagrams.length} diagrams</span>
            <span aria-hidden="true">·</span>
            <span>{photos} photographs</span>
          </p>
        </div>
      </header>

      {GROUPS.map((g) => {
        const items = diagrams.filter((d) => d.id.startsWith(g.key));
        if (!items.length) return null;
        return (
          <section key={g.key} className="tlx-section" aria-label={g.title}>
            <div className="shell">
              <p className="tlx-kicker">Diagrams</p>
              <h2 className="tlx-h2">{g.title}</h2>
              <p className="tlx-note">{g.note}</p>
              <ul className="lib-grid">
                {items.map((d) => (
                  <li key={d.id} className="lib-item">
                    <Link href={d.href ?? '/resources'} className="lib-card">
                      <span className="lib-shot">
                        <Image
                          src={illustrationImage(d.id) ?? `${IMAGE_DIR}/${d.file}`}
                          alt={d.alt}
                          width={d.width}
                          height={d.height}
                          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw"
                          className="lib-img"
                        />
                      </span>
                      <span className="lib-caption">{d.caption ?? d.alt}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        );
      })}

      <section className="tlx-section" aria-label="The floor collection">
        <div className="shell">
          <p className="tlx-kicker">Photographs</p>
          <h2 className="tlx-h2">The floor collection</h2>
          <p className="tlx-note">
            Each tile cycles its room, detail and lifestyle shot. Representative images of the
            floors we install across the GTA — not documentation of one address.
          </p>
          <ul className="lib-grid">
            {floors.map((f, n) => {
              const shots = floorImages(f.slug);
              if (!shots) return null;
              return (
                <li key={f.slug} className="lib-item">
                  <div className="lib-card lib-card--photo">
                    <RotatingTile
                      shots={[shots.room, shots.detail, shots.lifestyle]}
                      alt={`${f.name} — ${f.species}, ${f.format}`}
                      index={n}
                    />
                    <span className="lib-caption">
                      <strong>{f.name}</strong>
                      {f.species} · {f.format} · Janka {f.janka}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="tlx-section" aria-label="The machines">
        <div className="shell">
          <p className="tlx-kicker">Photographs</p>
          <h2 className="tlx-h2">The machines</h2>
          <p className="tlx-note">
            Six shots each — in use, in detail, in context. What each one does that the others
            cannot is in{' '}
            <Link href="/papers/hardwood-refinishing-machines-and-sequence">The Craft</Link>.
          </p>
          <ul className="lib-grid">
            {machines.map((m, n) => {
              const shots = machineImages(m.slug);
              if (!shots?.length) return null;
              return (
                <li key={m.slug} className="lib-item">
                  <div className="lib-card lib-card--photo">
                    <RotatingTile shots={shots} alt={m.alt} index={n + 3} interval={7000} />
                    <span className="lib-caption">
                      <strong>{m.name}</strong>
                      {m.does}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="tlx-section" aria-label="How this library is built">
        <div className="shell">
          <p className="tlx-kicker">Method</p>
          <h2 className="tlx-h2">Why the diagrams do not move</h2>
          <p className="tlx-note">
            The photographs rotate with a slow Ken Burns push, in four alternating variants so no
            two adjacent tiles drift the same way, staggered so the grid breathes rather than
            blinks, and paused entirely while off-screen.
          </p>
          <p className="tlx-note">
            The diagrams are still, deliberately. Someone reading the substrate cross-section is
            tracing a fastener from a board into a joist — a frame scaling underneath makes that
            harder, not more alive. Motion on an explanatory diagram spends comprehension to buy
            atmosphere the diagram does not need. A viewer who has asked their system for reduced
            motion gets both surfaces still.
          </p>
          <div className="fw-actions">
            <Link className="fw-cta fw-cta--ghost" href="/resources">
              All resources
            </Link>
            <Link className="fw-cta fw-cta--ghost" href="/glossary">
              Glossary
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
