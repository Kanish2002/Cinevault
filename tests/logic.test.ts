import { describe, it, expect } from "vitest";
import {
  filterLibrary,
  sortLibrary,
  smartCollections,
  recommendationScore,
} from "@/lib/filters";
import { mediaKey } from "@/types";
import { row, result } from "./fixtures";
import { hasConflict, validateChange } from "@/lib/sync/protocol";
describe("classification, filtering, ranking and sync", () => {
  it("separates media types and same-title language variants", () => {
    expect(mediaKey("movie", 96)).not.toBe(mediaKey("tv", 96));
    const movies = [row(1, "ml", "Drishyam"), row(2, "hi", "Drishyam")];
    expect(filterLibrary(movies, { language: "ml" })[0].tmdbId).toBe(1);
  });
  it("combines language, genre, platform, status, runtime, country and ratings", () => {
    const rows = [row(), row(2, "en", "Interstellar")];
    expect(
      filterLibrary(rows, {
        language: "ta",
        genre: "Thriller",
        status: "To Watch",
        provider: "Netflix",
        type: "movie",
        country: "IN",
        runtime: "long",
        imdb: "8",
        decade: "2020",
      }),
    ).toHaveLength(1);
    expect(filterLibrary(rows, { runtime: "short" })).toHaveLength(0);
  });
  it("does not infer availability from expired metadata", () => {
    const m = row();
    m.availability!.expiresAt = "2020-01-01";
    expect(filterLibrary([m], { provider: "Netflix" })).toHaveLength(0);
  });
  it("sorts missing IMDb ratings after real ones", () => {
    const a = row(1),
      b = row(2);
    a.imdbRating = null;
    expect(sortLibrary([a, b], "imdb")[0].tmdbId).toBe(2);
  });
  it("creates dynamic language and genre categories without duplicate media", () => {
    const rows = [row()];
    expect(
      smartCollections(rows).find((s) => s.id === "lang:ta")?.rows,
    ).toHaveLength(1);
    expect(
      smartCollections(rows).find((s) => s.id === "genre:Thriller")?.rows,
    ).toHaveLength(1);
    expect(rows).toHaveLength(1);
  });
  it("recommendations exclude saved titles and score preferred languages", () => {
    expect(recommendationScore(result(), [row()], ["ta"])).toBe(-1);
    expect(
      recommendationScore(result(2, "ta"), [row()], ["ta"]),
    ).toBeGreaterThan(recommendationScore(result(3, "en"), [row()], ["ta"]));
  });
  it("checks sync revisions, canonical identity and untrusted payload", () => {
    const change = {
      key: "media/movie:911",
      kind: "media" as const,
      recordId: "movie:911",
      payload: row(),
      deleted: false,
      baseRevision: 1,
      mutationId: crypto.randomUUID(),
    };
    expect(() => validateChange(change)).not.toThrow();
    expect(() => validateChange({ ...change, recordId: "movie:2" })).toThrow();
    expect(
      hasConflict(change, {
        key: change.key,
        kind: "media",
        recordId: change.recordId,
        payload: {},
        deleted: false,
        revision: 2,
        sequence: 1,
      }),
    ).toBe(true);
  });
});
