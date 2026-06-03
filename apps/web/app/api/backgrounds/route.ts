import { NextResponse } from 'next/server';

const TTL_SECONDS = 60 * 30;
export const revalidate = 1800;

type Bg = { url: string; alt: string; credit: string; creditUrl: string };

const THEMES: Record<string, string[]> = {
  hero: ['hardwood floor living room interior', 'wooden staircase home interior', 'oak hardwood flooring modern home'],
  craft: ['wood grain texture detail', 'carpenter sanding hardwood floor', 'wood workshop craftsmanship'],
  homes: ['toronto house exterior', 'modern home interior wood', 'luxury living room hardwood'],
  finish: ['walnut wood interior architecture', 'elegant dining room hardwood floor', 'sunlit room wooden floor'],
};

export async function GET(request: Request) {
  const key = process.env.UNSPLASH_ACCESS_KEY || 'FnT9d_oLWEiWTI3KlXMNdvzB_EXHo-bUdGdrPSSQAdY';
  if (!key || key === 'your_key_here' || key === 'your_new_key_here') {
    return NextResponse.json({ images: [] as Bg[], source: 'none' });
  }
  const theme = new URL(request.url).searchParams.get('theme') || 'hero';
  const queries = THEMES[theme] ?? THEMES.hero;
  try {
    const seed = Math.floor(Date.now() / (TTL_SECONDS * 1000));
    const q1 = queries[seed % queries.length];
    const q2 = queries[(seed + 1) % queries.length];
    const fetchQ = (q: string) =>
      fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&orientation=landscape&per_page=10&content_filter=high`,
        { headers: { Authorization: `Client-ID ${key}` }, next: { revalidate: TTL_SECONDS } }
      ).then((r) => (r.ok ? r.json() : { results: [] }));
    const [a, b] = await Promise.all([fetchQ(q1), fetchQ(q2)]);
    const results = [...(a.results ?? []), ...(b.results ?? [])];
    const seen = new Set<string>();
    const images: Bg[] = [];
    for (const p of results) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      images.push({ url: p.urls.regular, alt: p.alt_description ?? 'Wood interior', credit: p.user?.name ?? 'Unsplash', creditUrl: p.user?.links?.html ?? 'https://unsplash.com' });
    }
    return NextResponse.json({ images, source: 'unsplash', theme });
  } catch {
    return NextResponse.json({ images: [] as Bg[], source: 'error' });
  }
}
