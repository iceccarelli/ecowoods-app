import { NextResponse } from 'next/server';

const TTL_SECONDS = 60 * 30;
export const revalidate = 1800;

type Bg = { url: string; alt: string; credit: string; creditUrl: string };

const QUERIES = [
  'hardwood floor living room interior',
  'wooden staircase home interior',
  'wood kitchen cabinetry interior',
  'solid wood door interior home',
  'oak hardwood flooring modern home',
  'walnut wood interior architecture',
];

export async function GET() {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key || key === 'your_key_here' || key === 'your_new_key_here') {
    return NextResponse.json({ images: [] as Bg[], source: 'none' });
  }
  try {
    const seed = Math.floor(Date.now() / (TTL_SECONDS * 1000));
    const q1 = QUERIES[seed % QUERIES.length];
    const q2 = QUERIES[(seed + 3) % QUERIES.length];

    const fetchQ = (q: string) =>
      fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&orientation=landscape&per_page=10&content_filter=high`,
        { headers: { Authorization: `Client-ID ${key}` }, next: { revalidate: TTL_SECONDS } }
      ).then((r) => (r.ok ? r.json() : { results: [] }));

    const [a, b] = await Promise.all([fetchQ(q1), fetchQ(q2)]);
    const results = [...(a.results ?? []), ...(b.results ?? [])];

    const seen = new Set();
    const images = [];
    for (const p of results) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      images.push({
        url: p.urls.regular,
        alt: p.alt_description ?? 'Wood interior',
        credit: p.user?.name ?? 'Unsplash',
        creditUrl: p.user?.links?.html ?? 'https://unsplash.com',
      });
    }
    return NextResponse.json({ images, source: 'unsplash' });
  } catch {
    return NextResponse.json({ images: [] as Bg[], source: 'error' });
  }
}
