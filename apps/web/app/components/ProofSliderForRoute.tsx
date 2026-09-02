import { platesForRoute } from '@/content/proof-sliders';
import { ProofSlider } from './ProofSlider';

/**
 * Mounts whichever plates the registry assigns to a route.
 *
 * Every plate already carries its own `routes` list — that is the placement map
 * from the briefs, in data. So a page does not choose a plate; it says where it
 * is, and the registry answers. One line per page instead of a decision per
 * page, and moving a plate between pages is a registry edit rather than a hunt
 * through fifteen files.
 *
 * It renders nothing when a route has no plate, so it is safe on a dynamic
 * route that covers thirty-two cities of which six have a slider.
 */
export function ProofSliderForRoute({ route, className }: { route: string; className?: string }) {
  const plates = platesForRoute(route);
  if (!plates.length) return null;
  return (
    <section className="section-tight" aria-label="Before and after">
      <div className="shell">
        {plates.map((p) => (
          <ProofSlider key={p.id} plate={p} className={className} />
        ))}
      </div>
    </section>
  );
}
