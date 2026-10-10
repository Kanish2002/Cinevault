import { db, queue, getPreferences } from '@/lib/db';
import { api } from '@/lib/utils';
import {
  mediaSchema,
  entrySchema,
  listSchema,
  itemSchema,
  cloudPrefsSchema,
  defaultPrefs,
  type SyncRecord,
  type SyncKind,
} from '@/types';
import { isAccountOwner } from './identity';
import { validateChange } from './protocol';

export async function assertVaultOwner(owner: string) {
  if (!isAccountOwner(owner)) throw new Error('Sign in to your account before synchronizing.');
  await db.transaction('rw', db.state, async () => {
    const binding = await db.state.get('sync-owner');
    if (binding && binding.value !== owner)
      throw new Error(
        'This local vault belongs to another account. Export a backup and use a separate browser profile for this account.',
      );
    await db.state.put({ id: 'sync-owner', value: owner });
  });
}

let activeSync: { owner: string; promise: Promise<{ conflicts: number }> } | undefined;
export function runSync(owner: string) {
  if (activeSync) {
    if (activeSync.owner !== owner)
      return Promise.reject(
        new Error('Another account is synchronizing. Please retry after it finishes.'),
      );
    return activeSync.promise;
  }
  const promise = synchronize(owner).finally(() => {
    activeSync = undefined;
  });
  activeSync = { owner, promise };
  return promise;
}

async function applyRemote(remote: SyncRecord) {
  const checked = validateChange({
    ...remote,
    baseRevision: remote.revision,
    mutationId: crypto.randomUUID(),
  });
  if (checked.deleted) {
    await db[checked.kind].delete(checked.recordId);
    return;
  }
  switch (checked.kind) {
    case 'media':
      await db.media.put(mediaSchema.parse(checked.payload));
      break;
    case 'entries':
      await db.entries.put(entrySchema.parse(checked.payload));
      break;
    case 'lists':
      await db.lists.put(listSchema.parse(checked.payload));
      break;
    case 'items':
      await db.items.put(itemSchema.parse(checked.payload));
      break;
    case 'preferences':
      await db.preferences.put({
        ...(await getPreferences()),
        ...cloudPrefsSchema.parse(checked.payload),
      });
      break;
  }
}

async function synchronize(owner: string) {
  await assertVaultOwner(owner);
  let conflicts = 0;
  for (let pass = 0; pass < 20; pass++) {
    const pending = await db.outbox.limit(100).toArray(),
      cursor = Number((await db.state.get('sync-cursor'))?.value || 0);
    const response = await api<{
      accepted: { key: string; mutationId: string; revision: number }[];
      conflicts: string[];
      records: SyncRecord[];
      cursor: number;
      hasMore: boolean;
    }>('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedOwner: owner, changes: pending, cursor }),
    });
    await db.state.put({ id: 'sync-owner', value: owner });
    await db.transaction(
      'rw',
      [db.media, db.entries, db.lists, db.items, db.preferences, db.sync, db.outbox, db.state],
      async () => {
        for (const ack of response.accepted) {
          const latest = await db.outbox.get(ack.key);
          if (latest?.mutationId === ack.mutationId) await db.outbox.delete(ack.key);
          else if (latest) await db.outbox.put({ ...latest, baseRevision: ack.revision });
        }
        for (const remote of response.records) {
          const queued = await db.outbox.get(remote.key);
          await db.sync.put(remote);
          if (queued) {
            if (response.conflicts.includes(remote.key))
              await db.state.put({
                id: `conflict/${remote.key}`,
                value: JSON.stringify(remote),
              });
            continue;
          }
          await applyRemote(remote);
        }
        for (const key of response.conflicts) {
          if (!(await db.state.get(`conflict/${key}`))) {
            const remote = await db.sync.get(key);
            if (remote)
              await db.state.put({
                id: `conflict/${key}`,
                value: JSON.stringify(remote),
              });
          }
        }
        await db.state.put({
          id: 'sync-cursor',
          value: String(response.cursor),
        });
      },
    );
    conflicts += response.conflicts.length;
    if (response.conflicts.length || (!response.hasMore && (await db.outbox.count()) === 0)) break;
  }
  return { conflicts };
}
export async function resolveConflict(key: string, choice: 'local' | 'cloud') {
  const remote = JSON.parse((await db.state.get(`conflict/${key}`))!.value) as SyncRecord;
  await db.transaction(
    'rw',
    [db.media, db.entries, db.lists, db.items, db.preferences, db.outbox, db.sync, db.state],
    async () => {
      const pending = await db.outbox.get(key);
      if (choice === 'local' && pending)
        await db.outbox.put({
          ...pending,
          baseRevision: remote.revision,
          mutationId: crypto.randomUUID(),
        });
      else {
        await db.outbox.delete(key);
        await applyRemote(remote);
      }
      await db.state.delete(`conflict/${key}`);
    },
  );
}
export async function queueExisting() {
  await db.transaction(
    'rw',
    [db.media, db.entries, db.lists, db.items, db.preferences, db.outbox, db.sync],
    async () => {
      for (const kind of ['media', 'entries', 'lists', 'items'] as SyncKind[])
        for (const row of await db[kind].toArray())
          if (!(await db.sync.get(`${kind}/${row.id}`))) await queue(kind, row.id, row);
      const prefs = cloudPrefsSchema.parse(await getPreferences());
      if (
        !(await db.sync.get('preferences/main')) &&
        JSON.stringify(prefs) !== JSON.stringify(cloudPrefsSchema.parse(defaultPrefs))
      )
        await queue('preferences', 'main', prefs);
    },
  );
}
