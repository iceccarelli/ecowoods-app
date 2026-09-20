import Image from 'next/image';
import type { ProjectDetail } from '@/lib/projects';

/**
 * A close plate — one delight per frame, shown as a static tile rather than
 * KenBurnsStill's drifting animation. These are already tight crops; a Ken
 * Burns move on a plate this close has nowhere to go before it clips the
 * subject.
 */
export default function DetailPlate({
  detail,
  sizes = '(max-width: 767px) 45vw, (max-width: 1279px) 30vw, 260px',
}: {
  detail: ProjectDetail;
  sizes?: string;
}) {
  return (
    <figure className="pj-plate pj-plate--detail">
      <Image
        src={detail.src}
        alt={detail.alt}
        width={detail.width}
        height={detail.height}
        sizes={sizes}
        className="pj-plate-img"
      />
    </figure>
  );
}
