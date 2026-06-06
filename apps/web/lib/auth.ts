/**
 * Auth.js v5 — Credentials + optional OAuth providers.
 * OAuth providers are conditionally added based on env vars.
 */

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import type { UserRole } from '@prisma/client';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function linkOrphanQuotes(userId: string, email: string): Promise<number> {
  try {
    const { count } = await db.quoteRequest.updateMany({
      where: { email, userId: null },
      data: { userId },
    });
    return count;
  } catch {
    return 0;
  }
}

// Build providers list — avoids top-level import of optional providers
// so a missing/broken provider package never crashes the whole auth module.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildProviders(): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list: any[] = [
    Credentials({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const user = await db.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ];

  if (process.env.AUTH_GOOGLE_ID) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Google = require('next-auth/providers/google').default;
      list.push(Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET }));
    } catch { /* provider unavailable */ }
  }

  if (process.env.AUTH_FACEBOOK_ID) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Facebook = require('next-auth/providers/facebook').default;
      list.push(Facebook({ clientId: process.env.AUTH_FACEBOOK_ID, clientSecret: process.env.AUTH_FACEBOOK_SECRET }));
    } catch { /* provider unavailable */ }
  }

  if (process.env.AUTH_APPLE_ID) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Apple = require('next-auth/providers/apple').default;
      list.push(Apple({ clientId: process.env.AUTH_APPLE_ID, clientSecret: process.env.AUTH_APPLE_SECRET }));
    } catch { /* provider unavailable */ }
  }

  return list;
}

export const { auth, signIn, signOut, handlers } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  providers: buildProviders(),

  callbacks: {
    async jwt({ token, user, account }) {
      if (user?.id) {
        token.id = user.id;
        token.provider = account?.provider ?? 'credentials';
        // Always fetch role from DB — ensures correct role regardless of
        // how the user object is shaped (credentials vs OAuth).
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });
        token.role = (dbUser?.role ?? 'CUSTOMER') as UserRole;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.provider = token.provider as string;
      }
      return session;
    },
  },

  events: {
    async createUser({ user }) {
      if (!user.id || !user.email) return;
      const linked = await linkOrphanQuotes(user.id, user.email);
      await db.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } }).catch(() => {});
      if (linked > 0) console.log(`[auth] linked ${linked} quote(s) to ${user.email}`);
    },
  },

  pages: { signIn: '/login', error: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  debug: process.env.NODE_ENV === 'development',
});

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: UserRole;
      provider?: string;
    };
  }
}
declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
    provider?: string;
  }
}
