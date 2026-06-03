import NextAuth, { type NextAuthOptions } from "next-auth"

export const authOptions: NextAuthOptions = {
  providers: [],
  secret: process.env.NEXTAUTH_SECRET || (process.env.NODE_ENV === "development" 
    ? "dev-insecure-change-me-in-prod" 
    : undefined),
  session: { strategy: "jwt" },
  debug: process.env.NODE_ENV === "development",
  callbacks: {
    async jwt({ token }) { return token },
    async session({ session }) { return session },
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
