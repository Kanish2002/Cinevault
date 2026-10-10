import Dexie, { type Table } from 'dexie';
import type {
  Media,
  LibraryEntry,
  CustomList,
  ListItem,
  Preferences,
  Outbox,
  SyncRecord,
  SyncKind,
} from '@/types';
import { defaultPrefs, mediaKey, cloudPrefsSchema } from '@/types';
export class CineDatabase extends Dexie {
  media!: Table<Media, string>;
  entries!: Table<LibraryEntry, string>;
  lists!: Table<CustomList, string>;
  items!: Table<ListItem, string>;
  preferences!: Table<Preferences, string>;
  outbox!: Table<Outbox, string>;
  sync!: Table<SyncRecord, string>;
  state!: Table<{ id: string; value: string }, string>;
  constructor(name = 'cinevault') {
    super(name);
    this.version(1).stores({
      media: 'id, [mediaType+tmdbId], originalLanguage, *genres',
      entries: 'id, &mediaId, watchStatus, dateAdded, dateWatched',
      lists: 'id, name',
      items: 'id, &[listId+mediaId], listId, mediaId, position',
      preferences: 'id',
      outbox: 'key',
      sync: 'key, sequence',
      state: 'id',
    });
  }
}
export const db = new CineDatabase();
export const now = () => new Date().toISOString();
export async function queue(kind: SyncKind, recordId: string, payload: unknown, deleted = false) {
  const key = `${kind}/${recordId}`;
  const previous = await db.outbox.get(key);
  const remote = await db.sync.get(key);
  await db.outbox.put({
    key,
    kind,
    recordId,
    payload,
    deleted,
    baseRevision: previous?.baseRevision ?? remote?.revision ?? 0,
    mutationId: crypto.randomUUID(),
  });
}
export async function getPreferences() {
  return (await db.preferences.get('main')) || defaultPrefs;
}
export async function savePreferences(patch: Partial<Preferences>) {
  await db.transaction('rw', [db.preferences, db.outbox, db.sync], async () => {
    const before = await getPreferences();
    const after = { ...before, ...patch, id: 'main' as const };
    await db.preferences.put(after);
    const shared = cloudPrefsSchema.parse(after);
    if (JSON.stringify(shared) !== JSON.stringify(cloudPrefsSchema.parse(before)))
      await queue('preferences', 'main', shared);
  });
}
export async function addMedia(media: Media) {
  return db.transaction(
    'rw',
    [db.media, db.entries, db.outbox, db.sync, db.preferences],
    async () => {
      const id = mediaKey(media.mediaType, media.tmdbId);
      const existing = await db.entries.get(id);
      if (existing) return false;
      const stamp = now();
      const entry: LibraryEntry = {
        id,
        mediaId: id,
        watchStatus: (await getPreferences()).defaultWatchStatus,
        dateAdded: stamp,
        dateWatched: null,
        personalRating: null,
        notes: '',
        isFavorite: false,
        rewatchCount: 0,
        updatedAt: stamp,
      };
      await db.media.put({ ...media, id });
      await db.entries.add(entry);
      await queue('media', id, { ...media, id });
      await queue('entries', id, entry);
      return true;
    },
  );
}
export async function updateEntry(id: string, patch: Partial<LibraryEntry>) {
  return db.transaction('rw', [db.entries, db.outbox, db.sync], async () => {
    const entry = await db.entries.get(id);
    if (!entry) throw new Error('This title is not saved yet.');
    const merged = {
      ...entry,
      ...patch,
      id,
      mediaId: entry.mediaId,
      updatedAt: now(),
    };
    if (patch.watchStatus === 'Watched' && !entry.dateWatched)
      merged.dateWatched = now().slice(0, 10);
    await db.entries.put(merged);
    await queue('entries', id, merged);
  });
}
export async function refreshMedia(media: Media) {
  await db.transaction('rw', [db.media, db.outbox, db.sync], async () => {
    await db.media.put(media);
    await queue('media', media.id, media);
  });
}
export async function removeMedia(id: string) {
  await db.transaction('rw', [db.media, db.entries, db.items, db.outbox, db.sync], async () => {
    for (const item of await db.items.where('mediaId').equals(id).toArray()) {
      await db.items.delete(item.id);
      await queue('items', item.id, null, true);
    }
    await db.entries.delete(id);
    await db.media.delete(id);
    await queue('entries', id, null, true);
    await queue('media', id, null, true);
  });
}
export async function saveList(
  data: Pick<CustomList, 'name' | 'description' | 'coverImage'>,
  id = crypto.randomUUID(),
) {
  await db.transaction('rw', [db.lists, db.outbox, db.sync], async () => {
    const old = await db.lists.get(id);
    const list = {
      ...data,
      id,
      createdAt: old?.createdAt || now(),
      updatedAt: now(),
    };
    await db.lists.put(list);
    await queue('lists', id, list);
  });
  return id;
}
export async function deleteList(id: string) {
  await db.transaction('rw', [db.lists, db.items, db.outbox, db.sync], async () => {
    for (const item of await db.items.where('listId').equals(id).toArray()) {
      await db.items.delete(item.id);
      await queue('items', item.id, null, true);
    }
    await db.lists.delete(id);
    await queue('lists', id, null, true);
  });
}
export async function listMembership(listId: string, mediaId: string, include: boolean) {
  await db.transaction('rw', [db.items, db.lists, db.entries, db.outbox, db.sync], async () => {
    if (!(await db.lists.get(listId)) || !(await db.entries.get(mediaId)))
      throw new Error('List or saved title no longer exists.');
    const id = `${listId}/${mediaId}`;
    if (include) {
      const old = await db.items.get(id);
      if (old) return;
      const positions = await db.items.where('listId').equals(listId).toArray();
      const item = {
        id,
        listId,
        mediaId,
        position: Math.max(-1, ...positions.map((i) => i.position)) + 1,
        dateAdded: now(),
      };
      await db.items.put(item);
      await queue('items', id, item);
    } else {
      await db.items.delete(id);
      await queue('items', id, null, true);
    }
  });
}
export async function reorderItem(id: string, direction: -1 | 1) {
  await db.transaction('rw', [db.items, db.outbox, db.sync], async () => {
    const item = await db.items.get(id);
    if (!item) return;
    const items = (await db.items.where('listId').equals(item.listId).toArray()).sort(
      (a, b) => a.position - b.position,
    );
    const index = items.findIndex((i) => i.id === id),
      other = items[index + direction];
    if (!other) return;
    [items[index], items[index + direction]] = [other, item];
    for (let i = 0; i < items.length; i++) {
      const row = { ...items[i], position: i };
      await db.items.put(row);
      await queue('items', row.id, row);
    }
  });
}
export async function library() {
  const [media, entries] = await Promise.all([db.media.toArray(), db.entries.toArray()]);
  const map = new Map(entries.map((e) => [e.mediaId, e]));
  return media.flatMap((m) => (map.has(m.id) ? [{ ...m, entry: map.get(m.id)! }] : []));
}
