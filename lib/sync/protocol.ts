import { z } from 'zod';
import {
  mediaSchema,
  entrySchema,
  listSchema,
  itemSchema,
  cloudPrefsSchema,
  mediaKey,
  type SyncRecord,
  type Outbox,
} from '@/types';
export const syncRequest = z.object({
  expectedOwner: z.string().regex(/^google:[^\s:]{1,255}$/),
  cursor: z.number().int().nonnegative(),
  changes: z
    .array(
      z.object({
        key: z.string().max(600),
        kind: z.enum(['media', 'entries', 'lists', 'items', 'preferences']),
        recordId: z.string().max(500),
        payload: z.unknown(),
        deleted: z.boolean(),
        baseRevision: z.number().int().nonnegative(),
        mutationId: z.string().uuid(),
      }),
    )
    .max(100),
});
export function validateChange(c: Outbox) {
  if (c.key !== `${c.kind}/${c.recordId}`) throw new Error('Invalid sync key.');
  if (c.kind === 'preferences' && (c.recordId !== 'main' || c.deleted))
    throw new Error('Invalid preference record.');
  if (c.deleted) return c;
  const schema = {
    media: mediaSchema,
    entries: entrySchema,
    lists: listSchema,
    items: itemSchema,
    preferences: cloudPrefsSchema,
  }[c.kind];
  const payload = schema.parse(c.payload);
  if (payload.id !== c.recordId) throw new Error('Record identifier mismatch.');
  if (c.kind === 'media') {
    const m = mediaSchema.parse(payload);
    if (m.id !== mediaKey(m.mediaType, m.tmdbId)) throw new Error('Noncanonical media ID.');
  }
  if (c.kind === 'entries') {
    const e = entrySchema.parse(payload);
    if (e.id !== e.mediaId) throw new Error('Noncanonical entry.');
  }
  return { ...c, payload };
}
export function hasConflict(change: Outbox, remote: SyncRecord | undefined) {
  return !!remote && remote.revision !== change.baseRevision;
}
