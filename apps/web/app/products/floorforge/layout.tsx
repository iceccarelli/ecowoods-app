import type { Metadata } from 'next';

/* ──────────────────── METADATA ────────────────────
   Lives here (Server Component) because page.tsx is a
   Client Component — Next.js forbids exporting `metadata`
   from a module marked "use client".
   ────────────────────────────────────────────────── */
export const metadata: Metadata = {
  title: 'FloorForge — Autonomous Floor Refinishing Pilot',
  description:
    'FloorForge is an early-access autonomous floor refinishing robot in the software + hardware alignment stage. Open to contractor pilots in 2026. Join the interest list.',
  openGraph: {
    title: 'FloorForge — Autonomous Floor Refinishing Pilot',
    description:
      'Autonomous floor sanding and finishing. Early-access pilot for contractors. In active development.',
    type: 'website',
  },
};

export default function FloorForgeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
