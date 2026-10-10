import { describe, expect, it, vi, afterEach } from 'vitest';
import { accountOwner, isAccountOwner, syncIdentityMatches } from '@/lib/sync/identity';
import { syncRequest, validateChange } from '@/lib/sync/protocol';
import { cloudConfigured, authBaseUrl } from '@/lib/sync/auth';
import { defaultPrefs } from '@/types';
vi.mock('@neondatabase/auth/next/server', () => ({ createNeonAuth: vi.fn() }));
afterEach(() => vi.unstubAllEnvs());
describe('Neon account identity', () => {
  it('requires a database, managed Auth URL and strong cookie secret', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://test.invalid/cinevault');
    vi.stubEnv('NEON_AUTH_BASE_URL', '');
    vi.stubEnv('DATABASE_NEON_AUTH_BASE_URL', 'https://test.invalid/auth');
    vi.stubEnv('NEON_AUTH_COOKIE_SECRET', 'x'.repeat(32));
    expect(cloudConfigured()).toBe(true);
    expect(authBaseUrl()).toBe('https://test.invalid/auth');
    vi.stubEnv('NEON_AUTH_COOKIE_SECRET', 'short');
    expect(cloudConfigured()).toBe(false);
  });
  it('derives ownership only from a stable managed account ID', () => {
    expect(accountOwner('1234')).toBe('neon:1234');
    for (const value of [undefined, '', 'google:1234', 'github:1234', 'bad id'])
      expect(accountOwner(value)).toBeUndefined();
    expect(isAccountOwner('github:1234')).toBe(false);
    expect(syncIdentityMatches(undefined, 'neon:1234')).toBe(false);
    expect(syncIdentityMatches('neon:alice', 'neon:bob')).toBe(false);
    expect(syncIdentityMatches('neon:alice', 'neon:alice')).toBe(true);
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
