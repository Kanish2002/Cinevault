import Papa from "papaparse";
import { z } from "zod";
import {
  mediaSchema,
  entrySchema,
  listSchema,
  itemSchema,
  prefsSchema,
  defaultPrefs,
  mediaKey,
  type Media,
  type LibraryEntry,
  type CustomList,
  type ListItem,
} from "@/types";
import { db, queue, now } from "@/lib/db";
export type Backup = {
  schemaVersion: 1;
  exportedAt: string;
  media: Media[];
  entries: LibraryEntry[];
  lists: CustomList[];
  items: ListItem[];
  preferences: typeof defaultPrefs;
};
const envelope = z.object({
  schemaVersion: z.literal(1),
  media: z.array(z.unknown()).max(50000),
  entries: z.array(z.unknown()).max(50000),
  lists: z.array(z.unknown()).max(10000),
  items: z.array(z.unknown()).max(100000),
  preferences: z.unknown().optional(),
});
export function validateBackup(value: unknown) {
  const parsed = envelope.parse(value);
  const errors: string[] = [];
  const validate = <T>(
    rows: unknown[],
    schema: z.ZodType<T>,
    name: string,
  ): T[] =>
    rows.flatMap((row, index) => {
      const p = schema.safeParse(row);
      if (!p.success) {
        errors.push(`${name} row ${index + 1}: invalid fields`);
        return [];
      }
      return [p.data];
    });
  const media = validate(parsed.media, mediaSchema, "Media").filter((m) => {
    if (m.id !== mediaKey(m.mediaType, m.tmdbId)) {
      errors.push(`Noncanonical ID: ${m.title}`);
      return false;
    }
    return true;
  });
  const ids = new Set(media.map((m) => m.id));
  const entries = validate(parsed.entries, entrySchema, "Entry").filter((e) => {
    if (!ids.has(e.mediaId) || e.id !== e.mediaId) {
      errors.push(`Orphan entry ${e.id}`);
      return false;
    }
    return true;
  });
  const entryIds = new Set(entries.map((e) => e.mediaId));
  const lists = validate(parsed.lists, listSchema, "List");
  const listIds = new Set(lists.map((l) => l.id));
  const items = validate(parsed.items, itemSchema, "List item")
    .filter((i) => {
      if (!listIds.has(i.listId) || !entryIds.has(i.mediaId)) {
        errors.push(`Orphan list item ${i.id}`);
        return false;
      }
      return true;
    })
    .map((i) => ({ ...i, id: `${i.listId}/${i.mediaId}` }));
  const preferences = prefsSchema.safeParse(parsed.preferences);
  return {
    data: {
      schemaVersion: 1 as const,
      exportedAt: now(),
      media: media.filter((m) => entryIds.has(m.id)),
      entries,
      lists,
      items,
      preferences: preferences.success
        ? { ...preferences.data, syncEnabled: false }
        : defaultPrefs,
    },
    errors,
  };
}
export async function makeBackup(): Promise<Backup> {
  return db.transaction(
    "r",
    [db.media, db.entries, db.lists, db.items, db.preferences],
    async () => ({
      schemaVersion: 1,
      exportedAt: now(),
      media: await db.media.toArray(),
      entries: await db.entries.toArray(),
      lists: await db.lists.toArray(),
      items: await db.items.toArray(),
      preferences: (await db.preferences.get("main")) || defaultPrefs,
    }),
  );
}
export function toCSV(backup: Backup) {
  const media = new Map(backup.media.map((m) => [m.id, m]));
  return Papa.unparse(
    backup.entries.map((e) => {
      const m = media.get(e.mediaId)!;
      return {
        tmdbId: m.tmdbId,
        mediaType: m.mediaType,
        title: m.title,
        year: m.releaseDate.slice(0, 4),
        originalLanguage: m.originalLanguage,
        genres: m.genres.map((g) => g.name).join(";"),
        watchStatus: e.watchStatus,
        personalRating: e.personalRating,
        notes: e.notes,
        isFavorite: e.isFavorite,
        dateAdded: e.dateAdded,
        dateWatched: e.dateWatched,
        rewatchCount: e.rewatchCount,
        metadata: JSON.stringify(m),
        entry: JSON.stringify(e),
      };
    }),
    { escapeFormulae: true },
  );
}
export function parseCSV(text: string) {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  if (
    !result.meta.fields?.includes("tmdbId") ||
    !result.meta.fields.includes("mediaType")
  )
    throw new Error(
      "CSV must contain tmdbId and mediaType columns. For full restore, use a CineVault JSON backup.",
    );
  const media: unknown[] = [],
    entries: unknown[] = [],
    errors = result.errors.map((e) => e.message);
  for (const [index, row] of result.data.entries()) {
    try {
      if (!row.metadata || !row.entry)
        throw new Error(
          "Use a CineVault CSV export with metadata and entry columns; plain title lists belong in Bulk Add.",
        );
      media.push(JSON.parse(row.metadata));
      entries.push(JSON.parse(row.entry));
    } catch (e) {
      errors.push(
        `CSV row ${index + 2}: ${e instanceof Error ? e.message : "invalid JSON"}`,
      );
    }
  }
  const validated = validateBackup({
    schemaVersion: 1,
    media,
    entries,
    lists: [],
    items: [],
  });
  return { data: validated.data, errors: [...errors, ...validated.errors] };
}
export async function importBackup(backup: Backup, mode: "merge" | "replace") {
  return db.transaction(
    "rw",
    [
      db.media,
      db.entries,
      db.lists,
      db.items,
      db.preferences,
      db.outbox,
      db.sync,
    ],
    async () => {
      if (mode === "replace") {
        for (const kind of ["media", "entries", "lists", "items"] as const) {
          for (const row of await db[kind].toArray())
            await queue(kind, row.id, null, true);
          await db[kind].clear();
        }
        await db.preferences.put({ ...backup.preferences, syncEnabled: false });
      }
      let added = 0,
        duplicates = 0;
      const accepted = new Set<string>();
      for (const entry of backup.entries) {
        if (await db.entries.get(entry.id)) {
          duplicates++;
          continue;
        }
        const media = backup.media.find((m) => m.id === entry.mediaId);
        if (!media) continue;
        await db.media.put(media);
        await db.entries.put(entry);
        await queue("media", media.id, media);
        await queue("entries", entry.id, entry);
        accepted.add(entry.id);
        added++;
      }
      for (const list of backup.lists) {
        if (!(await db.lists.get(list.id))) {
          await db.lists.put(list);
          await queue("lists", list.id, list);
        }
      }
      for (const item of backup.items) {
        if (await db.items.get(item.id)) continue;
        if (
          (await db.entries.get(item.mediaId)) &&
          (await db.lists.get(item.listId))
        ) {
          await db.items.put(item);
          await queue("items", item.id, item);
        }
      }
      return {
        added,
        duplicates,
        lists: backup.lists.length,
        relationships: backup.items.length,
      };
    },
  );
}
export function download(content: string, name: string, type: string) {
  const blob = new Blob([content], { type });
  if (blob.size === 0) throw new Error("Backup is empty.");
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
