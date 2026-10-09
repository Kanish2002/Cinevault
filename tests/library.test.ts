import { beforeEach, afterAll, describe, it, expect } from "vitest";
import {
  db,
  addMedia,
  updateEntry,
  saveList,
  listMembership,
  deleteList,
  library,
  reorderItem,
  removeMedia,
  savePreferences,
} from "@/lib/db";
import { fixture } from "./fixtures";
beforeEach(async () => {
  for (const table of db.tables) await table.clear();
});
afterAll(() => db.close());
describe("IndexedDB collection integrity", () => {
  it("saves one canonical title under concurrent duplicate additions and preserves annotations", async () => {
    const m = fixture();
    await Promise.all([addMedia(m), addMedia(m)]);
    await updateEntry(m.id, {
      watchStatus: "Watched",
      notes: "My note",
      personalRating: 9,
    });
    expect(await addMedia(m)).toBe(false);
    expect(await db.entries.count()).toBe(1);
    const e = await db.entries.get(m.id);
    expect(e?.watchStatus).toBe("Watched");
    expect(e?.notes).toBe("My note");
    expect(e?.dateWatched).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("persists after closing and reopening the database", async () => {
    await addMedia(fixture());
    db.close();
    await db.open();
    expect((await library())[0].title).toBe("Vikram");
  });
  it("supports multiple lists without copies and list deletion preserves movies", async () => {
    await addMedia(fixture());
    const a = await saveList({
        name: "Weekend",
        description: "",
        coverImage: null,
      }),
      b = await saveList({
        name: "Favorites",
        description: "",
        coverImage: null,
      });
    await listMembership(a, "movie:911", true);
    await listMembership(a, "movie:911", true);
    await listMembership(b, "movie:911", true);
    expect(await db.items.count()).toBe(2);
    await deleteList(a);
    expect(await db.items.count()).toBe(1);
    expect(await db.entries.count()).toBe(1);
  });
  it("reorders relationships and removes orphan memberships", async () => {
    await addMedia(fixture());
    await addMedia(fixture(912, "en", "Interstellar"));
    const l = await saveList({
      name: "Weekend",
      description: "",
      coverImage: null,
    });
    await listMembership(l, "movie:911", true);
    await listMembership(l, "movie:912", true);
    await reorderItem(`${l}/movie:912`, -1);
    expect((await db.items.get(`${l}/movie:912`))?.position).toBe(0);
    await removeMedia("movie:912");
    expect(await db.items.count()).toBe(1);
    expect((await db.outbox.get("media/movie:912"))?.deleted).toBe(true);
  });
  it("honors the configured default status", async () => {
    await savePreferences({ defaultWatchStatus: "On Hold" });
    await addMedia(fixture());
    expect((await db.entries.get("movie:911"))?.watchStatus).toBe("On Hold");
  });
});
