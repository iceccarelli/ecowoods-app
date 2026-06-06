/**
 * Next.js Middleware — Route Protection
 * Reads the JWT cookie directly (Edge-compatible, no DB round-trip).
 */

import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const pathname = req.nextUrl.pathname;

  // req.auth is set by next-auth v5 — contains the decoded session
  const session = req.auth;
  const isLoggedIn = !!session?.user?.id;
  const role = session?.user?.role;
  const isAdmin = role === 'ADMIN';

  // Debug (remove after confirming it works)
  if (process.env.NODE_ENV === 'development' && isLoggedIn) {
    console.log(`[middleware] ${pathname} | user: ${session?.user?.email} | role: ${role}`);
  }

  // ── Admin routes ──────────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, req.nextUrl));
    }
    if (!isAdmin) {
      return NextResponse.redirect(new URL('/mypage', req.nextUrl));
    }
    return NextResponse.next();
  }

  // ── Customer portal ───────────────────────────────────────────────────
  if (pathname.startsWith('/mypage')) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, req.nextUrl));
    }
    return NextResponse.next();
  }

  // ── Redirect already-logged-in users away from auth pages ────────────
  if (pathname === '/login' || pathname === '/register') {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL(isAdmin ? '/admin' : '/mypage', req.nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/mypage/:path*', '/admin/:path*', '/login', '/register'],
};
