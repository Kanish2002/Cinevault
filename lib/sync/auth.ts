import { createNeonAuth } from '@neondatabase/auth/next/server';

export const authBaseUrl = () =>
  process.env.NEON_AUTH_BASE_URL || process.env.DATABASE_NEON_AUTH_BASE_URL;
export const cloudConfigured = () =>
  !!(
    process.env.DATABASE_URL &&
    authBaseUrl() &&
    process.env.NEON_AUTH_COOKIE_SECRET &&
    process.env.NEON_AUTH_COOKIE_SECRET.length >= 32
  );
let auth: ReturnType<typeof createNeonAuth> | undefined;
export function getAuth() {
  if (!cloudConfigured()) throw new Error('Account sync is not configured.');
  return (auth ??= createNeonAuth({
    baseUrl: authBaseUrl()!,
    cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET!, sessionDataTtl: 30 },
  }));
}
