import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { db, addMedia, savePreferences, getPreferences, updateEntry } from '@/lib/db';
import { assertVaultOwner, runSync, queueExisting, resolveConflict } from '@/lib/sync/client';
import { cloudPrefsSchema, defaultPrefs } from '@/types';
import { fixture } from './fixtures';

beforeEach(async () => {
  for (const table of db.tables) await table.clear();
});
afterEach(() => vi.unstubAllGlobals());
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const empty = { accepted: [], conflicts: [], records: [], cursor: 0, hasMore: false };

describe('account-scoped cloud sync and offline changes', () => {
  it('claims an unbound vault atomically and blocks a different account before any request', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await assertVaultOwner('google:alice');
    await expect(runSync('google:bob')).rejects.toThrow('another account');
    await expect(runSync('github:alice')).rejects.toThrow('Google');
    expect(fetcher).not.toHaveBeenCalled();
    expect((await db.state.get('sync-owner'))?.value).toBe('google:alice');
  });
  it('sends the expected account guard and clears only acknowledged changes', async () => {
    await addMedia(fixture());
    const pending = await db.outbox.toArray();
    const fetcher = vi.fn(async (_url: string, options: RequestInit) => {
      expect(JSON.parse(options.body as string).expectedOwner).toBe('google:alice');
      return response({
        ...empty,
        accepted: pending.map((c) => ({ key: c.key, mutationId: c.mutationId, revision: 1 })),
      });
    });
    vi.stubGlobal('fetch', fetcher);
    await runSync('google:alice');
    expect(await db.outbox.count()).toBe(0);
    expect(await db.entries.count()).toBe(1);
  });
  it('preserves offline edits if the signed-in account changes or the network fails', async () => {
    await addMedia(fixture());
    await updateEntry('movie:911', { notes: 'Keep me', watchStatus: 'Watched' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ error: 'Your signed-in account changed.' }, 409)),
    );
    await expect(runSync('google:alice')).rejects.toThrow('account changed');
    expect(await db.outbox.count()).toBe(2);
    expect((await db.entries.get('movie:911'))?.notes).toBe('Keep me');
  });
  it('deduplicates simultaneous background and manual sync operations', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetcher = vi.fn(async () => {
      await gate;
      return response(empty);
    });
    vi.stubGlobal('fetch', fetcher);
    const first = runSync('google:alice');
    const second = runSync('google:alice');
    expect(first).toBe(second);
    await expect(runSync('google:bob')).rejects.toThrow('Another account');
    release();
    await Promise.all([first, second]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('downloads shared preferences without changing sync consent or backup history', async () => {
    await savePreferences({ syncEnabled: true, lastBackupAt: '2026-10-10' });
    const remote = {
      key: 'preferences/main',
      recordId: 'main',
      kind: 'preferences',
      payload: { ...cloudPrefsSchema.parse(defaultPrefs), preferredRegion: 'GB', theme: 'light' },
      revision: 1,
      sequence: 8,
      deleted: false,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ ...empty, records: [remote], cursor: 8 })),
    );
    await runSync('google:alice');
    expect(await getPreferences()).toMatchObject({
      preferredRegion: 'GB',
      theme: 'light',
      syncEnabled: true,
      lastBackupAt: '2026-10-10',
    });
    expect(await db.outbox.count()).toBe(0);
    expect((await db.state.get('sync-cursor'))?.value).toBe('8');
  });
  it('queues preference changes while leaving device-only settings local', async () => {
    await savePreferences({ syncEnabled: true, lastBackupAt: '2026-10-10' });
    expect(await db.outbox.count()).toBe(0);
    await queueExisting();
    expect(await db.outbox.count()).toBe(0);
    await savePreferences({ preferredRegion: 'GB' });
    const mutation = await db.outbox.get('preferences/main');
    expect(mutation?.payload).toMatchObject({ preferredRegion: 'GB' });
    expect(mutation?.payload).not.toHaveProperty('syncEnabled');
    expect(mutation?.payload).not.toHaveProperty('lastBackupAt');
  });
  it('keeps local preference conflicts for explicit resolution', async () => {
    await savePreferences({ preferredRegion: 'GB', syncEnabled: true });
    const remote = {
      key: 'preferences/main',
      recordId: 'main',
      kind: 'preferences',
      payload: cloudPrefsSchema.parse(defaultPrefs),
      revision: 2,
      sequence: 10,
      deleted: false,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response({ ...empty, records: [remote], cursor: 10, conflicts: [remote.key] }),
      ),
    );
    expect(await runSync('google:alice')).toEqual({ conflicts: 1 });
    expect((await getPreferences()).preferredRegion).toBe('GB');
    await resolveConflict(remote.key, 'cloud');
    expect(await getPreferences()).toMatchObject({ preferredRegion: 'IN', syncEnabled: true });
    expect(await db.outbox.count()).toBe(0);
  });
});
