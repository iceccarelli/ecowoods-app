import KenBurnsStill from './KenBurnsStill';
import type { ProjectStill } from '@/lib/projects';

/**
 * Two frames, side by side, labelled.
 *
 * WHY THIS IS NOT A SLIDER
 *
 * ProofSlider exists in this repository and it is the right component when two
 * frames share a camera position — dragging a handle across a locked-tripod
 * pair is the most convincing before/after there is, precisely because nothing
 * moves except the wood.
 *
 * These two chapters were not shot that way. The camera is close but never
 * identical, and a wipe across two slightly different angles manufactures a
 * correspondence the photographs do not have. It looks better and it is less
 * true, which is the wrong trade for a company whose entire positioning is
 * that its numbers can be checked.
 *
 * So: two-up, both frames visible at once, and the fixed point named
 * underneath so the reader can verify the pairing themselves.
 */
export default function BeforeAfterPair({
  before,
  after,
  anchor,
}: {
  before: ProjectStill;
  after: ProjectStill;
  anchor: string;
}) {
  return (
    <figure className="pj-pair">
      <div className="pj-pair-grid">
        <div className="pj-pair-side">
          <p className="pj-pair-label">Before</p>
          <KenBurnsStill still={before} sizes="(max-width: 767px) 100vw, 45vw" />
        </div>
        <div className="pj-pair-side">
          <p className="pj-pair-label pj-pair-label--after">After</p>
          <KenBurnsStill still={after} sizes="(max-width: 767px) 100vw, 45vw" />
        </div>
      </div>
      <figcaption className="pj-pair-cap">
        Same subject in both frames: {anchor}. Not a locked-tripod pair — the camera moved
        between visits, so these are shown side by side rather than wiped across each other.
      </figcaption>
    </figure>
  );
}
