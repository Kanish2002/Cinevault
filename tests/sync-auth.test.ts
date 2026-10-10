import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Account, Profile, Session } from 'next-auth';
import { isGoogleOwner, syncIdentityMatches } from '@/lib/sync/identity';
import { syncRequest, validateChange } from '@/lib/sync/protocol';
import { defaultPrefs } from '@/types';

const configure = () => {
  vi.stubEnv('DATABASE_URL', 'postgresql://test.invalid/cinevault');
  vi.stubEnv('NEXTAUTH_SECRET', 'test-only-secret-not-a-real-credential');
  vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-client-secret');
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('Google sign-in identity', () => {
  it('enables cloud only with Neon and the Google server credentials', async () => {
    configure();
    const { cloudConfigured, authOptions } = await import('@/lib/sync/auth');
    expect(cloudConfigured()).toBe(true);
    expect(authOptions.providers.map((p) => p.id)).toEqual(['google']);
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
    expect(cloudConfigured()).toBe(false);
  });
  it('accepts only verified Google profiles matching the provider subject', async () => {
    configure();
    const { authOptions } = await import('@/lib/sync/auth');
    const account: Account = { provider: 'google', providerAccountId: '1234', type: 'oauth' };
    const profile: Profile & { email_verified: boolean } = {
      sub: '1234',
      email: 'user@example.com',
      email_verified: true,
    };
    const signIn = authOptions.callbacks!.signIn!;
    expect(await signIn({ user: { id: '1234' }, account, profile })).toBe(true);
    expect(
      await signIn({
        user: { id: '1234' },
        account,
        profile: Object.assign({}, profile, { email_verified: false }),
      }),
    ).toBe(false);
    expect(
      await signIn({ user: { id: '1234' }, account, profile: { ...profile, sub: 'different' } }),
    ).toBe(false);
    expect(
      await signIn({ user: { id: '1234' }, account: { ...account, provider: 'github' }, profile }),
    ).toBe(false);
  });
  it('creates a stable Google owner and invalidates old provider sessions', async () => {
    configure();
    const { authOptions } = await import('@/lib/sync/auth');
    const token = await authOptions.callbacks!.jwt!({
      token: {},
      user: { id: '1234' },
      account: { provider: 'google', providerAccountId: '1234', type: 'oauth' },
    });
    expect(token.sub).toBe('google:1234');
    const session: Session = { user: { email: 'user@example.com' }, expires: '2027-01-01' };
    const extra = {
      user: { id: '1234', email: 'user@example.com', emailVerified: null },
      newSession: undefined,
      trigger: 'update' as const,
    };
    await authOptions.callbacks!.session!({ session, token, ...extra });
    expect(session.user?.id).toBe('google:1234');
    await authOptions.callbacks!.session!({ session, token: { sub: 'github:1234' }, ...extra });
    expect(session.user?.id).toBeUndefined();
  });
  it('never authorizes a supplied owner without a matching verified session', () => {
    expect(isGoogleOwner('github:1234')).toBe(false);
    expect(syncIdentityMatches(undefined, 'google:1234')).toBe(false);
    expect(syncIdentityMatches('google:alice', 'google:bob')).toBe(false);
    expect(syncIdentityMatches('google:alice', 'google:alice')).toBe(true);
    expect(() => syncRequest.parse({ cursor: 0, changes: [] })).toThrow();
  });
  it('strips local-only preferences and rejects noncanonical preference records', () => {
    const change = {
      key: 'preferences/main',
      recordId: 'main',
      kind: 'preferences' as const,
      payload: defaultPrefs,
      deleted: false,
      baseRevision: 0,
      mutationId: crypto.randomUUID(),
    };
    expect(validateChange(change).payload).not.toHaveProperty('syncEnabled');
    expect(() => validateChange({ ...change, deleted: true })).toThrow();
    expect(() =>
      validateChange({ ...change, key: 'preferences/other', recordId: 'other' }),
    ).toThrow();
  });
});
