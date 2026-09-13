'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ASSEMBLY_DEFAULT_SPECIES,
  ASSEMBLY_LAYERS,
  ASSEMBLY_SPECIES,
  assemblyDesignHref,
  grainTextureFor,
} from '@/lib/floor-assembly';

/**
 * VIS-05 — THE EXPLODED FLOOR ASSEMBLY.
 *
 * The homepage sold a finished floor with pictures of a finished floor. That is
 * the one part of the job every competitor can photograph too, and the one part
 * a buyer cannot evaluate — every sanded floor looks good on the day it is
 * handed over. This shows the four layers underneath it, where the price
 * differences actually live, as a 3D stack that pulls apart, painted with the
 * real photographed grain crops already in public/textures.
 *
 * Each layer carries the question to put to whoever is quoting. That is the
 * commercial point: a visitor who leaves this section knowing to ask for a
 * wear-layer thickness in millimetres and a moisture reading with a date can
 * tell two quotes apart — and the quote that answers them is ours.
 *
 * ── F-205 IS WHY THE MOVING PART CONTAINS NO TEXT ──────────────────────────
 *
 * The last animated element on this page was the hero stat. It rendered through
 * CountUp, which published three times in the DOM, and ecowoods.ca served
 * `26026+ Years in Toronto` in its server HTML to every machine that read it.
 * On a site whose whole strategy is being quotable, that is the worst available
 * bug.
 *
 * So the split here is strict and is the entire design. EVERY word — heading,
 * lede, five layer names, five descriptions, five questions, the species names
 * and the species note — is ordinary static JSX that server-renders once, in
 * its final form, and never animates. The animated stack is five EMPTY divs
 * inside aria-hidden. There is no text path through the animation at all, so
 * there is no value it can publish twice.
 *
 * ── P0.4 IS WHY THIS IS NOT THE HERO ───────────────────────────────────────
 *
 * The work this is modelled on runs WebGL above the fold. The hero here is
 * deliberately one static image with fetchpriority="high" because it is the LCP
 * element, and the ranking this page exists to win is worth more than the
 * animation. This sits below the price, where it costs the LCP nothing.
 *
 * ── WHY NO ANIMATION LIBRARY ───────────────────────────────────────────────
 *
 * framer-motion is declared in package.json and has no importers. It stays that
 * way here for a reason that is about correctness rather than weight: a
 * declarative motion library server-renders its INITIAL state into the style
 * attribute, so a scroll-triggered reveal ships the COLLAPSED stack in the HTML
 * and anything that does not run JavaScript — which includes several of the
 * answer engines this site is written for — sees a flat rectangle.
 *
 * Here the exploded, annotated, readable state is the CSS default. It is what
 * renders with no JavaScript, and what renders under prefers-reduced-motion.
 * The only thing script does is take that away for a moment, below the fold,
 * so it can be given back as movement. The graphic is never less informative
 * because of the animation, and the homepage carries no new bytes for it.
 */
export function FloorAssembly() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [speciesId, setSpeciesId] = useState(ASSEMBLY_DEFAULT_SPECIES);
  const [active, setActive] = useState<string | null>(null);

  const species =
    ASSEMBLY_SPECIES.find((s) => s.id === speciesId) ?? ASSEMBLY_SPECIES[0]!;

  /**
   * The reveal, and the two cases it deliberately refuses to run in.
   *
   * The stack is exploded in CSS. This collapses it and then lets it open when
   * it is scrolled to — but only when collapsing is invisible. If the section
   * is ALREADY on screen when this mounts, collapsing it would be a flash of
   * the wrong state in front of somebody who is looking straight at it, so the
   * effect returns and the stack simply stays open. Same under reduced motion.
   */
  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const box = node.getBoundingClientRect();
    const onScreen = box.top < window.innerHeight && box.bottom > 0;
    if (onScreen) return;

    node.dataset.collapsed = 'true';
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          delete node.dataset.collapsed;
          obs.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="section fa-section wood-grain-dark noise-overlay" id="assembly">
      <div className="shell">
        <div className="fa-head">
          <p className="fa-kicker">What a floor is made of</p>
          <h2 className="fa-h2">
            Five layers. Four of them are{' '}
            <span className="serif-italic">invisible once we leave.</span>
          </h2>
          <p className="fa-lede">
            Every quote prices the same five layers. The difference between a floor that
            lasts thirty years and one that cups in its second winter is in the four you
            never see again — so each layer below carries the question to put to whoever
            is quoting you, including us.
          </p>
        </div>

        {/* THE MOVING PART. Five empty divs. No text enters here. */}
        <div className="fa-stage" ref={stageRef} aria-hidden="true">
          <div className="fa-stack">
            {ASSEMBLY_LAYERS.map((l, i) => (
              <div
                key={l.id}
                className="fa-layer"
                data-i={i}
                data-active={active === l.id ? 'true' : undefined}
                style={
                  i === 1
                    ? {
                        backgroundImage: `linear-gradient(155deg, rgba(140,84,38,.55), rgba(92,52,22,.62)), url(${grainTextureFor(species.id)})`,
                      }
                    : undefined
                }
              />
            ))}
          </div>
        </div>

        {/* THE SPECIES. Real product names as static text; the only thing that
            changes is which photographed crop the wear layer is painted with.
            Every name is in the HTML whichever one is selected. */}
        <div className="fa-species">
          <span className="fa-species-label">Shown in</span>
          <div className="fa-species-chips" role="group" aria-label="Show the assembly in a species">
            {ASSEMBLY_SPECIES.map((s) => (
              <button
                key={s.id}
                type="button"
                className="fa-chip"
                aria-pressed={s.id === species.id}
                onClick={() => setSpeciesId(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
          <p className="fa-species-note">
            {species.name} · Janka {species.janka} · {species.swatchNote}
          </p>
        </div>

        <ol className="fa-legend">
          {ASSEMBLY_LAYERS.map((l) => (
            <li
              key={l.id}
              className="fa-item"
              data-active={active === l.id ? 'true' : undefined}
              onMouseEnter={() => setActive(l.id)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(l.id)}
              onBlur={() => setActive(null)}
            >
              <span className="fa-n">{l.n}</span>
              <div>
                <p className="fa-t">{l.title}</p>
                <p className="fa-d">{l.body}</p>
                <p className="fa-ask">
                  <span className="fa-ask-label">Ask any contractor:</span> {l.ask}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="fa-actions">
          <Link className="btn btn-copper btn-lg" href={assemblyDesignHref(species)}>
            Specify this floor in {species.name}
          </Link>
          <a className="btn btn-ghost-light btn-lg" href="#quote">
            Get a fixed price in writing
          </a>
        </div>
      </div>
    </section>
  );
}

export default FloorAssembly;
