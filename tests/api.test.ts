import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  normalizeResult,
  search,
  getMedia,
  ratings,
  providers,
} from "@/lib/api/tmdb";
import { GET } from "@/app/api/search/route";
beforeEach(() => {
  vi.stubEnv("TMDB_API_READ_ACCESS_TOKEN", "test-token");
  vi.stubEnv("OMDB_API_KEY", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
});
it("normalizes documented TMDB movie and TV contracts and excludes people", () => {
  expect(
    normalizeResult({
      id: 1,
      media_type: "movie",
      title: "Vikram",
      original_language: "ta",
      vote_average: 7.7,
    })?.id,
  ).toBe("movie:1");
  expect(
    normalizeResult({ id: 1, media_type: "tv", name: "Money Heist" })?.id,
  ).toBe("tv:1");
  expect(
    normalizeResult({ id: 1, media_type: "person", name: "Actor" }),
  ).toBeNull();
});
it("search URL-encodes native script and preserves alternative same-title results", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              id: 1,
              media_type: "movie",
              title: "Drishyam",
              original_language: "ml",
              release_date: "2013-01-01",
            },
            {
              id: 2,
              media_type: "movie",
              title: "Drishyam",
              original_language: "hi",
              release_date: "2015-01-01",
            },
          ],
        }),
      ),
  );
  const rows = await search("Drishyam");
  expect(rows).toHaveLength(2);
  await search("விக்ரம்");
  expect(String(fetch.mock.calls[1][0])).toContain("query=%E0");
});
it("gracefully degrades IMDb without substituting TMDB", async () => {
  expect(await ratings("tt123")).toEqual({
    imdbRating: null,
    imdbVotes: null,
    ratingsState: "unconfigured",
  });
});
it("maps details, cast and provider categories from documented contracts", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) =>
    String(url).includes("/watch/providers")
      ? Response.json({
          results: {
            IN: {
              link: "https://www.themoviedb.org/movie/911/watch",
              flatrate: [
                {
                  provider_id: 8,
                  provider_name: "Netflix",
                  logo_path: "/netflix.png",
                },
              ],
              rent: [
                { provider_id: 2, provider_name: "Apple TV", logo_path: null },
              ],
            },
          },
        })
      : Response.json({
          id: 911,
          title: "Vikram",
          original_language: "ta",
          genres: [{ id: 28, name: "Action" }],
          runtime: 175,
          vote_average: 7.7,
          vote_count: 20,
          credits: {
            cast: [{ id: 1, name: "Kamal Haasan", character: "Vikram" }],
            crew: [{ id: 2, name: "Lokesh Kanagaraj", job: "Director" }],
          },
          external_ids: { imdb_id: "tt9179430" },
        }),
  );
  const m = await getMedia("movie", 911);
  expect(m.originalLanguage).toBe("ta");
  expect(m.imdbRating).toBeNull();
  expect(m.availability?.groups.flatrate[0].name).toBe("Netflix");
  expect(m.availability?.groups.rent[0].name).toBe("Apple TV");
  expect(m.crew[0].job).toBe("Director");
});
it("does not report absent provider data as unavailability", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ results: {} }),
  );
  expect((await providers("movie", 1, "IN")).state).toBe("unknown");
});
it("retrieves OMDb votes and ratings independently", async () => {
  vi.stubEnv("OMDB_API_KEY", "test");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      imdbRating: "8.7",
      imdbVotes: "1,234,567",
      Response: "True",
    }),
  );
  expect(await ratings("tt123456")).toEqual({
    imdbRating: 8.7,
    imdbVotes: 1234567,
    ratingsState: "available",
  });
});
it("returns actionable missing-key errors and validates input", async () => {
  vi.stubEnv("TMDB_API_READ_ACCESS_TOKEN", "");
  const r = await GET(new Request("http://localhost/api/search?q=Vikram"));
  expect(r.status).toBe(503);
  expect((await r.json()).error).toContain("TMDB");
  expect(
    (await GET(new Request("http://localhost/api/search?q="))).status,
  ).toBe(400);
});
