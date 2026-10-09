import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
export const cloudConfigured = () =>
  !!(
    process.env.DATABASE_URL &&
    process.env.NEXTAUTH_SECRET &&
    process.env.GITHUB_CLIENT_ID &&
    process.env.GITHUB_CLIENT_SECRET
  );
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers:
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            authorization: { params: { scope: "read:user user:email" } },
          }),
        ]
      : [],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      if (account) token.sub = `github:${account.providerAccountId}`;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.sub;
      return session;
    },
  },
};
