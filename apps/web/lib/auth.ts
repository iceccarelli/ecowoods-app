import NextAuth, { type NextAuthOptions } from "next-auth"

export const authOptions: NextAuthOptions = {
  providers: [],
  secret: process.env.NEXTAUTH_SECRET || "dev-insecure-change-me-in-prod",
  session: { strategy: "jwt" },
  debug: process.env.NODE_ENV === "development",
  callbacks: {
    async jwt({ token }) { return token },
    async session({ session }) { return session },
  },
}
