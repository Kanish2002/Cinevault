import { db, queue } from "@/lib/db";
import { api } from "@/lib/utils";
import {
  mediaSchema,
  entrySchema,
  listSchema,
  itemSchema,
  type SyncRecord,
  type SyncKind,
} from "@/types";
export async function runSync(owner: string) {
  const binding = await db.state.get("sync-owner");
  if (binding && binding.value !== owner)
    throw new Error(
      "This local vault is linked to another account. Export it and use a separate browser profile for this account.",
    );
  let conflicts = 0;
  for (let pass = 0; pass < 20; pass++) {
    const pending = await db.outbox.limit(100).toArray(),
      cursor = Number((await db.state.get("sync-cursor"))?.value || 0);
    const response = await api<{
      accepted: { key: string; mutationId: string; revision: number }[];
      conflicts: string[];
      records: SyncRecord[];
      cursor: number;
      hasMore: boolean;
    }>("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes: pending, cursor }),
    });
    await db.state.put({ id: "sync-owner", value: owner });
    await db.transaction(
      "rw",
      [db.media, db.entries, db.lists, db.items, db.sync, db.outbox, db.state],
      async () => {
        for (const ack of response.accepted) {
          const latest = await db.outbox.get(ack.key);
          if (latest?.mutationId === ack.mutationId)
            await db.outbox.delete(ack.key);
          else if (latest)
            await db.outbox.put({ ...latest, baseRevision: ack.revision });
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
          const kind = remote.kind;
          if (remote.deleted) {
            await db[kind].delete(remote.recordId);
            continue;
          }
          const schema = {
            media: mediaSchema,
            entries: entrySchema,
            lists: listSchema,
            items: itemSchema,
          }[kind];
          const p = schema.safeParse(remote.payload);
          if (!p.success)
            throw new Error("Cloud returned invalid record data.");
          if (kind === "media")
            await db.media.put(mediaSchema.parse(remote.payload));
          if (kind === "entries")
            await db.entries.put(entrySchema.parse(remote.payload));
          if (kind === "lists")
            await db.lists.put(listSchema.parse(remote.payload));
          if (kind === "items")
            await db.items.put(itemSchema.parse(remote.payload));
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
          id: "sync-cursor",
          value: String(response.cursor),
        });
      },
    );
    conflicts += response.conflicts.length;
    if (
      response.conflicts.length ||
      (!response.hasMore && (await db.outbox.count()) === 0)
    )
      break;
  }
  return { conflicts };
}
export async function resolveConflict(key: string, choice: "local" | "cloud") {
  const remote = JSON.parse(
    (await db.state.get(`conflict/${key}`))!.value,
  ) as SyncRecord;
  await db.transaction(
    "rw",
    [db.media, db.entries, db.lists, db.items, db.outbox, db.sync, db.state],
    async () => {
      const pending = await db.outbox.get(key);
      if (choice === "local" && pending)
        await db.outbox.put({
          ...pending,
          baseRevision: remote.revision,
          mutationId: crypto.randomUUID(),
        });
      else {
        await db.outbox.delete(key);
        if (remote.deleted) await db[remote.kind].delete(remote.recordId);
        else {
          if (remote.kind === "media")
            await db.media.put(mediaSchema.parse(remote.payload));
          if (remote.kind === "entries")
            await db.entries.put(entrySchema.parse(remote.payload));
          if (remote.kind === "lists")
            await db.lists.put(listSchema.parse(remote.payload));
          if (remote.kind === "items")
            await db.items.put(itemSchema.parse(remote.payload));
        }
      }
      await db.state.delete(`conflict/${key}`);
    },
  );
}
export async function queueExisting() {
  await db.transaction(
    "rw",
    [db.media, db.entries, db.lists, db.items, db.outbox, db.sync],
    async () => {
      for (const kind of ["media", "entries", "lists", "items"] as SyncKind[])
        for (const row of await db[kind].toArray())
          if (!(await db.sync.get(`${kind}/${row.id}`)))
            await queue(kind, row.id, row);
    },
  );
}
