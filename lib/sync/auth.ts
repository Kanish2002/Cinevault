import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { isGoogleOwner } from './identity';
export const cloudConfigured = () =>
  !!(
    process.env.DATABASE_URL &&
    process.env.NEXTAUTH_SECRET &&
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET
  );
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers:
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: { params: { scope: 'openid email profile', prompt: 'select_account' } },
          }),
        ]
      : [],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ account, profile }) {
      // Never link accounts by a browser-supplied email or by matching an email
      // from the old provider. Google verifies the profile in its OIDC flow.
      return (
        account?.provider === 'google' &&
        !!profile &&
        'email_verified' in profile &&
        profile.email_verified === true &&
        'sub' in profile &&
        profile.sub === account.providerAccountId
      );
    },
    async jwt({ token, account }) {
      if (account?.provider === 'google') token.sub = `google:${account.providerAccountId}`;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = isGoogleOwner(token.sub) ? token.sub : undefined;
      return session;
    },
  },
};
