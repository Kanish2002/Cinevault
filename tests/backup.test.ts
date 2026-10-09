import { beforeEach, it, expect } from "vitest";
import { db, addMedia, updateEntry, saveList, listMembership } from "@/lib/db";
import {
  makeBackup,
  validateBackup,
  importBackup,
  toCSV,
  parseCSV,
} from "@/lib/import-export";
import { fixture } from "./fixtures";
beforeEach(async () => {
  for (const table of db.tables) await table.clear();
});
it("round-trips full JSON annotations, custom lists and relationships", async () => {
  await addMedia(fixture());
  await updateEntry("movie:911", {
    watchStatus: "Watched",
    notes: "Tamil,\nA great film",
    personalRating: 9,
    isFavorite: true,
    rewatchCount: 2,
  });
  const id = await saveList({
    name: "Weekend",
    description: "Family",
    coverImage: null,
  });
  await listMembership(id, "movie:911", true);
  const b = validateBackup(JSON.parse(JSON.stringify(await makeBackup())));
  expect(b.errors).toHaveLength(0);
  for (const table of db.tables) await table.clear();
  await importBackup(b.data, "merge");
  expect((await db.entries.get("movie:911"))?.notes).toBe(
    "Tamil,\nA great film",
  );
  expect(await db.items.count()).toBe(1);
  expect(await db.lists.count()).toBe(1);
});
it("merge preserves existing watch status and notes", async () => {
  await addMedia(fixture());
  const b = await makeBackup();
  await updateEntry("movie:911", { watchStatus: "Watched", notes: "Keep me" });
  const r = await importBackup(b, "merge");
  expect(r.duplicates).toBe(1);
  expect((await db.entries.get("movie:911"))?.notes).toBe("Keep me");
});
it("rejects unsupported schema and recovers from partially invalid rows", async () => {
  await addMedia(fixture());
  const b = await makeBackup();
  expect(() => validateBackup({ ...b, schemaVersion: 99 })).toThrow();
  const recovered = validateBackup({
    ...b,
    media: [...b.media, { title: "broken" }],
  });
  expect(recovered.errors).toHaveLength(1);
  expect(recovered.data.entries).toHaveLength(1);
});
it("CSV round-trips Unicode and quotes without formula evaluation", async () => {
  await addMedia(fixture());
  await updateEntry("movie:911", { notes: 'தமிழ், "great"\nSecond line' });
  const parsed = parseCSV(toCSV(await makeBackup()));
  expect(parsed.errors).toHaveLength(0);
  expect(parsed.data.entries[0].notes).toBe('தமிழ், "great"\nSecond line');
  expect(() => parseCSV("title\nVikram")).toThrow();
});
it("replace removes previous titles and queues deletion tombstones", async () => {
  await addMedia(fixture());
  const b = await makeBackup();
  await addMedia(fixture(912));
  await importBackup(b, "replace");
  expect(await db.entries.count()).toBe(1);
  expect((await db.outbox.get("entries/movie:912"))?.deleted).toBe(true);
});
