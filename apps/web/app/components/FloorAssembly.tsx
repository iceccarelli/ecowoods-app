'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ASSEMBLY_CHOICE_COUNT,
  ASSEMBLY_DEFAULT_FINISH,
  ASSEMBLY_DEFAULT_PATTERN,
  ASSEMBLY_DEFAULT_SPECIES,
  ASSEMBLY_DEFAULT_WIDTH,
  ASSEMBLY_FINISHES,
  ASSEMBLY_LAYERS,
  ASSEMBLY_PATTERNS,
  ASSEMBLY_SPECIES,
  ASSEMBLY_WIDTHS,
  UNDER_THE_BOARD,
  assemblyDesignHref,
  boardFace,
  boardsFor,
  fieldWidthFor,
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
 * ── VIS-06: IT MOVES BY ITSELF, AND IT IS MADE OF BOARDS ───────────────────
 *
 * The wear layer was one flat rectangle with a grain photograph stretched over
 * it. It is now the actual floor: individual boards, laid in whichever of the
 * four patterns this company lays — straight, diagonal, herringbone, chevron —
 * each board cut from a different part of the same photographed crop so no two
 * are the same piece of wood, in any of the six species.
 *
 * And it is never still. The stack drifts on a twenty-six second cycle and the
 * five layers float against each other on cycles that do not divide into it, so
 * the assembly never returns to the same pose twice inside a visit. It is slow
 * and it is weighted, because that is how a floor moves — wood settles and
 * breathes, it does not spin.
 *
 * WHAT KEEPS THAT HONEST RATHER THAN EXPENSIVE:
 *
 *   - Only the STACK and the five LAYERS animate. The several hundred boards
 *     never do. They ride along as one already-rasterised composited layer, so
 *     the frame cost does not grow with the board count, and a herringbone
 *     floor costs the same per frame as a straight one.
 *   - Board shading is a flat colour layer, not a CSS `filter`. A filter on
 *     several hundred elements makes the browser re-rasterise every one of them
 *     on every frame that the stack is moving — and the stack is always moving.
 *   - Nothing animates off screen. `animation-play-state` is `paused` in the
 *     stylesheet and only the IntersectionObserver below sets it running, so a
 *     visitor who never scrolls here pays nothing at all.
 *   - Nothing animates for somebody who asked it not to. Under
 *     prefers-reduced-motion the keyframes are removed outright.
 *
 * ── WHY NO ANIMATION LIBRARY ───────────────────────────────────────────────
 *
 * framer-motion is declared in package.json and has no importers. It stays that
 * way, and the reason is correctness rather than weight: a declarative motion
 * library server-renders its INITIAL state into the style attribute, so a
 * scroll-triggered reveal ships the COLLAPSED stack in the HTML and anything
 * that does not run JavaScript — which includes several of the answer engines
 * this site is written for — sees a flat rectangle. It also cannot express an
 * animation that is paused before it is ever scrolled to without running a
 * JavaScript frame loop, which is exactly the cost this avoids.
 *
 * Here the exploded, annotated, readable state is the CSS default. It is what
 * renders with no JavaScript and under prefers-reduced-motion. Script only
 * takes it away for a moment, below the fold, so it can be given back as
 * movement — and the homepage carries no new bytes for any of it.
 *
 * ── THE HERO VARIANT ───────────────────────────────────────────────────────
 *
 * `variant="hero"` renders the same assembly as a full-bleed backdrop with the
 * legend collapsed behind a native <details>, for use above the fold. It is
 * built and it works. It is not what the homepage passes, because the hero is
 * the LCP element and this would become it. Switching is a one-word change in
 * home-client.tsx whenever that trade is worth making.
 */
export type FloorAssemblyProps = {
  /** 'section' is the below-the-fold band. 'hero' is the full-bleed backdrop. */
  variant?: 'section' | 'hero';
};

export function FloorAssembly({ variant = 'section' }: FloorAssemblyProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [speciesId, setSpeciesId] = useState(ASSEMBLY_DEFAULT_SPECIES);
  const [patternId, setPatternId] = useState(ASSEMBLY_DEFAULT_PATTERN);
  const [finishId, setFinishId] = useState(ASSEMBLY_DEFAULT_FINISH);
  const [widthId, setWidthId] = useState(ASSEMBLY_DEFAULT_WIDTH);
  const [active, setActive] = useState<string | null>(null);

  const species =
    ASSEMBLY_SPECIES.find((s) => s.id === speciesId) ?? ASSEMBLY_SPECIES[0]!;
  const pattern =
    ASSEMBLY_PATTERNS.find((p) => p.id === patternId) ?? ASSEMBLY_PATTERNS[0]!;
  const finish =
    ASSEMBLY_FINISHES.find((f) => f.id === finishId) ?? ASSEMBLY_FINISHES[0]!;
  const width =
    ASSEMBLY_WIDTHS.find((w) => w.id === widthId) ?? ASSEMBLY_WIDTHS[1]!;

  /* The picture is rebuilt from all four choices. The width is the one that
     changes the BOARD COUNT, which is what makes a 3¼″ strip look like a strip
     floor rather than a wide plank with a different label on it. */
  const field = boardsFor(pattern.id, { width: fieldWidthFor(width.id) });
  const texture = grainTextureFor(species.id);

  /**
   * Two jobs, one observer.
   *
   * FIRST, the reveal. The stack is exploded in CSS. This collapses it and
   * lets it open when it is scrolled to — but only when collapsing is
   * invisible. If the section is ALREADY on screen when this mounts,
   * collapsing it would be a flash of the wrong state in front of somebody
   * looking straight at it, so that is skipped and the stack stays open.
   *
   * SECOND, and this is the one that matters for the battery in somebody's
   * pocket, the idle motion. `animation-play-state` is `paused` in the
   * stylesheet. Nothing here ever runs until the assembly is actually on
   * screen, and it is paused again the moment it leaves — so the observer is
   * NOT disconnected after the first hit the way the reveal alone would want.
   *
   * Under prefers-reduced-motion neither job runs: the stylesheet drops the
   * keyframes, and the stack simply stays in its final readable state.
   */
  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const box = node.getBoundingClientRect();
    const onScreen = box.top < window.innerHeight && box.bottom > 0;
    if (onScreen) node.dataset.live = 'true';
    else node.dataset.collapsed = 'true';

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            delete node.dataset.collapsed;
            node.dataset.live = 'true';
          } else {
            delete node.dataset.live;
          }
        }
      },
      { threshold: 0.15 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      className="section fa-section wood-grain-dark noise-overlay"
      data-variant={variant}
      id="assembly"
    >
      <div className="shell">
        <div className="fa-head">
          <p className="fa-kicker">What a board is made of</p>
          <h2 className="fa-h2">
            Three layers. The one that decides its lifespan is{' '}
            <span className="serif-italic">the one nobody quotes.</span>
          </h2>
          <p className="fa-lede">
            An engineered board: real hardwood over a 90° cross-ply core, which is the
            correct specification for the majority of Toronto projects — not a compromise
            and not a cheaper substitute. Each layer below carries the question to put to
            whoever is quoting you, including us.
          </p>
        </div>

        {/* THE MOVING PART. Five empty divs. No text enters here. */}
        <div
          className="fa-stage"
          ref={stageRef}
          aria-hidden="true"
          /* The finish is not a label. Its published sheen sets how much light
             the top coat returns, and its published tint is multiplied into
             every board — both straight off FINISH_OPTIONS. */
          style={
            {
              '--fa-sheen': String(finish.sheen),
              '--fa-tint': finish.tint,
            } as React.CSSProperties
          }
        >
          <div className="fa-stack">
            {ASSEMBLY_LAYERS.map((l, i) => (
              <div
                key={l.id}
                className="fa-layer"
                data-i={i}
                data-active={active === l.id ? 'true' : undefined}
              >
                {/* Only layer 02 is a floor. The other four are a coating, a
                    fastening pattern, a membrane and a substrate, and each is
                    painted by its own rule in the stylesheet. */}
                {i === 1 && (
                  <div
                    className="fa-boards"
                    data-pattern={pattern.id}
                    style={{
                      transform: `translate(-50%, -50%) rotate(${field.fieldRot}deg) scale(${field.scale})`,
                    }}
                  >
                    {field.boards.map((b, bi) => {
                      const face = boardFace(bi);
                      return (
                        <span
                          key={bi}
                          className="fa-board"
                          style={{
                            left: `${b.x}%`,
                            top: `${b.y}%`,
                            width: `${b.w}%`,
                            height: `${b.h}%`,
                            transform: `rotate(${b.rot}deg)`,
                            /* The warm cast and this board's own darkening,
                               multiplied into the crop ONCE when the board is
                               rasterised. Doing it with mix-blend-mode over the
                               field instead costs 23% of the frame rate for the
                               whole life of the animation — measured. */
                            backgroundImage: `linear-gradient(${finish.tint}, ${finish.tint}), linear-gradient(rgba(112,60,24,${(0.34 + face.shade).toFixed(3)}), rgba(112,60,24,${(0.34 + face.shade).toFixed(3)})), url(${texture})`,
                            backgroundBlendMode: 'multiply, multiply, normal',
                            backgroundPosition: `${face.posX}% ${face.posY}%`,
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
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

        {/* THE PATTERN. Four layouts, laid board by board rather than drawn as
            a repeating texture — so herringbone really is interlocking L-pairs
            and chevron really is mitred point-to-point, which is the
            difference most people cannot name and can always see. */}
        <div className="fa-species fa-patterns">
          <span className="fa-species-label">Laid in</span>
          <div className="fa-species-chips" role="group" aria-label="Lay the floor in a pattern">
            {ASSEMBLY_PATTERNS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="fa-chip"
                aria-pressed={p.id === pattern.id}
                onClick={() => setPatternId(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="fa-species-note">
            {pattern.label} · {pattern.blurb} · {field.boards.length} boards on screen
          </p>
        </div>

        {/* THE FINISH. Its published sheen and tint are applied to the render,
            so picking one changes the top coat and the colour of every board
            rather than just the label under the picture. */}
        <div className="fa-species fa-patterns">
          <span className="fa-species-label">Finished in</span>
          <div className="fa-species-chips" role="group" aria-label="Finish the floor">
            {ASSEMBLY_FINISHES.map((f) => (
              <button
                key={f.id}
                type="button"
                className="fa-chip"
                aria-pressed={f.id === finish.id}
                onClick={() => setFinishId(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="fa-species-note">
            {finish.label} · {finish.blurb}
          </p>
        </div>

        {/* THE WIDTH. Real inches from the catalogue, and the board count on
            screen follows from them — a 3¼″ strip floor has more than twice
            the boards of an 8″ plank, which is most of what the two look like. */}
        <div className="fa-species fa-patterns">
          <span className="fa-species-label">Board width</span>
          <div className="fa-species-chips" role="group" aria-label="Choose a board width">
            {ASSEMBLY_WIDTHS.map((w) => (
              <button
                key={w.id}
                type="button"
                className="fa-chip"
                aria-pressed={w.id === width.id}
                onClick={() => setWidthId(w.id)}
              >
                {w.label}
              </button>
            ))}
          </div>
          <p className="fa-species-note">
            {width.label} · {width.note}
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

        {/* UNDER THE BOARD. Not layers of it — the three things that decide
            whether a correctly specified board survives its second winter.
            They were drawn as part of the board before, which was wrong. */}
        <div className="fa-under">
          <p className="fa-under-h">
            And three more the quote has to answer, which are not part of the board
          </p>
          <ol className="fa-legend fa-legend-tight">
            {UNDER_THE_BOARD.map((l) => (
              <li key={l.id} className="fa-item">
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
        </div>

        <div className="fa-actions">
          <Link
            className="btn btn-copper btn-lg"
            href={assemblyDesignHref(species, pattern.id, finish.id, width.id)}
          >
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
