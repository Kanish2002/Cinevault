import { z } from "zod";
import type { Media, SearchResult } from "@/types";
import { mediaKey, mediaSchema, availabilitySchema } from "@/types";
export class ProviderError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}
const inflight = new Map<string, Promise<unknown>>();
export async function providerFetch<T>(
  url: string,
  headers: HeadersInit = {},
  ttl = 3600,
): Promise<T> {
  const key = url;
  const old = inflight.get(key);
  if (old) return old as Promise<T>;
  const task = (async () => {
    for (let i = 0; i < 2; i++) {
      try {
        const r = await fetch(url, {
          headers,
          signal: AbortSignal.timeout(10000),
          next: { revalidate: ttl },
        });
        if (r.status === 429)
          throw new ProviderError(
            "Movie service rate limit reached. Please wait a moment.",
            429,
          );
        if (r.status >= 500 && i === 0) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          continue;
        }
        if (!r.ok)
          throw new ProviderError(
            r.status === 401
              ? "Movie service credentials need updating."
              : "Movie service could not complete this request.",
            r.status === 404 ? 404 : 502,
          );
        return (await r.json()) as T;
      } catch (e) {
        if (e instanceof ProviderError) throw e;
        if (i === 1)
          throw new ProviderError(
            "Movie service is unreachable. Your saved collection is safe.",
          );
      }
    }
    throw new ProviderError("Movie service unavailable.");
  })();
  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}
export function tmdb<T>(
  path: string,
  params: Record<string, string> = {},
  ttl = 3600,
) {
  const token = process.env.TMDB_API_READ_ACCESS_TOKEN;
  if (!token)
    throw new ProviderError(
      "Live movie search needs a TMDB API Read Access Token. Configure it in Vercel Settings → Environment Variables.",
      503,
    );
  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return providerFetch<T>(
    url.toString(),
    { Authorization: `Bearer ${token}`, Accept: "application/json" },
    ttl,
  );
}
const summary = z.object({
  id: z.number(),
  media_type: z.string().optional(),
  title: z.string().optional(),
  name: z.string().optional(),
  original_title: z.string().optional(),
  original_name: z.string().optional(),
  original_language: z.string().default(""),
  release_date: z.string().optional(),
  first_air_date: z.string().optional(),
  poster_path: z.string().nullable().optional(),
  backdrop_path: z.string().nullable().optional(),
  vote_average: z.number().optional(),
  overview: z.string().optional(),
  genre_ids: z.array(z.number()).optional(),
  popularity: z.number().optional(),
});
export function normalizeResult(
  value: unknown,
  type?: "movie" | "tv",
): SearchResult | null {
  const p = summary.safeParse(value);
  if (!p.success) return null;
  const d = p.data,
    t = type || d.media_type;
  if (t !== "movie" && t !== "tv") return null;
  return {
    id: mediaKey(t, d.id),
    tmdbId: d.id,
    mediaType: t,
    title: d.title || d.name || "Untitled",
    originalTitle: d.original_title || d.original_name || "",
    originalLanguage: d.original_language,
    releaseDate: d.release_date || d.first_air_date || "",
    posterPath: d.poster_path || null,
    backdropPath: d.backdrop_path || null,
    tmdbRating: d.vote_average || null,
    overview: d.overview || "",
    genreIds: d.genre_ids || [],
    popularity: d.popularity || 0,
  };
}
export function rankResults(
  rows: SearchResult[],
  query: string,
  releaseYear?: string,
) {
  const q = query.toLocaleLowerCase().normalize("NFKC");
  const score = (r: SearchResult) => {
    const names = [r.title, r.originalTitle].map((s) =>
      s.toLocaleLowerCase().normalize("NFKC"),
    );
    return (
      Math.max(
        ...names.map((n) =>
          n === q ? 100 : n.startsWith(q) ? 75 : n.includes(q) ? 50 : 0,
        ),
      ) +
      (releaseYear && r.releaseDate.startsWith(releaseYear) ? 50 : 0) +
      Math.log1p(r.popularity)
    );
  };
  return [...rows].sort((a, b) => score(b) - score(a));
}
export async function search(query: string) {
  const yearMatch = query.match(/\s+\(?((?:19|20)\d{2})\)?$/);
  const term = yearMatch ? query.slice(0, yearMatch.index).trim() : query;
  let data = await tmdb<{ results: unknown[] }>(
    "search/multi",
    { query: term, include_adult: "false", language: "en-US" },
    300,
  );
  let rows = data.results.flatMap((d) => {
    const m = normalizeResult(d);
    return m ? [m] : [];
  });
  if (!rows.length && term.length > 5) {
    const shorter = term.slice(0, -1);
    data = await tmdb(
      "search/multi",
      { query: shorter, include_adult: "false", language: "en-US" },
      300,
    );
    rows = data.results.flatMap((d) => {
      const m = normalizeResult(d);
      return m ? [m] : [];
    });
  }
  return rankResults(rows, term, yearMatch?.[1]).slice(0, 20);
}
const named = z.object({ id: z.number().optional(), name: z.string() });
const details = z.object({
  id: z.number(),
  title: z.string().optional(),
  name: z.string().optional(),
  original_title: z.string().optional(),
  original_name: z.string().optional(),
  original_language: z.string().default(""),
  overview: z.string().nullable().optional(),
  tagline: z.string().nullable().optional(),
  release_date: z.string().optional(),
  first_air_date: z.string().optional(),
  poster_path: z.string().nullable().optional(),
  backdrop_path: z.string().nullable().optional(),
  genres: z.array(z.object({ id: z.number(), name: z.string() })).default([]),
  runtime: z.number().nullable().optional(),
  episode_run_time: z.array(z.number()).optional(),
  vote_average: z.number().optional(),
  vote_count: z.number().optional(),
  spoken_languages: z
    .array(z.object({ english_name: z.string().optional(), name: z.string() }))
    .default([]),
  production_countries: z
    .array(z.object({ iso_3166_1: z.string() }))
    .default([]),
  production_companies: z.array(named).default([]),
  imdb_id: z.string().nullable().optional(),
  external_ids: z
    .object({ imdb_id: z.string().nullable().optional() })
    .optional(),
  credits: z
    .object({
      cast: z
        .array(
          z.object({
            id: z.number(),
            name: z.string(),
            character: z.string().optional(),
            profile_path: z.string().nullable().optional(),
          }),
        )
        .default([]),
      crew: z
        .array(
          z.object({
            id: z.number(),
            name: z.string(),
            job: z.string().optional(),
          }),
        )
        .default([]),
    })
    .optional(),
  videos: z
    .object({
      results: z.array(
        z.object({
          site: z.string(),
          key: z.string(),
          type: z.string(),
          official: z.boolean().optional(),
        }),
      ),
    })
    .optional(),
  alternative_titles: z
    .object({
      titles: z.array(z.object({ title: z.string() })).optional(),
      results: z.array(z.object({ title: z.string() })).optional(),
    })
    .optional(),
  images: z
    .object({ backdrops: z.array(z.object({ file_path: z.string() })) })
    .optional(),
  number_of_seasons: z.number().optional(),
  number_of_episodes: z.number().optional(),
  status: z.string().optional(),
  last_air_date: z.string().nullable().optional(),
  networks: z.array(named).optional(),
  seasons: z
    .array(
      z.object({
        season_number: z.number(),
        name: z.string(),
        episode_count: z.number(),
        air_date: z.string().nullable().optional(),
        poster_path: z.string().nullable().optional(),
      }),
    )
    .optional(),
});
export async function ratings(imdbId: string | null, fresh = false) {
  if (!process.env.OMDB_API_KEY)
    return {
      imdbRating: null,
      imdbVotes: null,
      ratingsState: "unconfigured" as const,
    };
  if (!imdbId || !/^tt\d+$/.test(imdbId))
    return {
      imdbRating: null,
      imdbVotes: null,
      ratingsState: "unavailable" as const,
    };
  try {
    const url = new URL("https://www.omdbapi.com/");
    url.searchParams.set("apikey", process.env.OMDB_API_KEY);
    url.searchParams.set("i", imdbId);
    const d = await providerFetch<{
      imdbRating?: string;
      imdbVotes?: string;
      Response?: string;
    }>(url.toString(), {}, fresh ? 0 : 86400);
    const rating = Number(d.imdbRating),
      votes = Number(d.imdbVotes?.replaceAll(",", ""));
    return {
      imdbRating: Number.isFinite(rating) ? rating : null,
      imdbVotes: Number.isFinite(votes) ? votes : null,
      ratingsState: Number.isFinite(rating)
        ? ("available" as const)
        : ("unavailable" as const),
    };
  } catch {
    return {
      imdbRating: null,
      imdbVotes: null,
      ratingsState: "error" as const,
    };
  }
}
export async function providers(
  type: "movie" | "tv",
  id: number,
  country: string,
  fresh = false,
) {
  try {
    const data = await tmdb<{
      results: Record<string, { link?: string; [key: string]: unknown }>;
    }>(`${type}/${id}/watch/providers`, {}, fresh ? 0 : 21600);
    const region = data.results[country];
    const groups: Record<
      string,
      { id: number; name: string; logoPath: string | null }[]
    > = {};
    for (const category of ["flatrate", "free", "ads", "rent", "buy"]) {
      const items = region?.[category];
      if (Array.isArray(items))
        groups[category] = items.map((p) => ({
          id: p.provider_id,
          name: p.provider_name,
          logoPath: p.logo_path || null,
        }));
    }
    return availabilitySchema.parse({
      country,
      link: region?.link || null,
      groups,
      checkedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 21600000).toISOString(),
      state: Object.values(groups).some((g) => g.length)
        ? "available"
        : "unknown",
    });
  } catch (e) {
    return availabilitySchema.parse({
      country,
      link: null,
      groups: {},
      checkedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      state: "error",
      error:
        e instanceof Error ? e.message : "Availability could not be checked.",
    });
  }
}
export async function getMedia(
  type: "movie" | "tv",
  id: number,
  country = "IN",
  fresh = false,
): Promise<Media> {
  const d = details.parse(
    await tmdb(
      `${type}/${id}`,
      {
        append_to_response:
          "credits,external_ids,videos,alternative_titles,images",
        include_image_language: "en,null",
      },
      fresh ? 0 : 86400,
    ),
  );
  const imdbId = d.imdb_id || d.external_ids?.imdb_id || null;
  const [rating, availability] = await Promise.all([
    ratings(imdbId, fresh),
    providers(type, id, country, fresh),
  ]);
  const trailer = d.videos?.results.find(
    (v) =>
      v.site === "YouTube" && v.type === "Trailer" && /^[\w-]+$/.test(v.key),
  );
  return mediaSchema.parse({
    id: mediaKey(type, id),
    tmdbId: id,
    mediaType: type,
    title: d.title || d.name || "Untitled",
    originalTitle: d.original_title || d.original_name || "",
    originalLanguage: d.original_language,
    overview: d.overview || "",
    tagline: d.tagline || "",
    releaseDate: d.release_date || d.first_air_date || "",
    posterPath: d.poster_path || null,
    backdropPath: d.backdrop_path || null,
    genres: d.genres,
    runtime:
      type === "movie"
        ? (d.runtime ?? null)
        : (d.episode_run_time?.[0] ?? null),
    tmdbRating: d.vote_average || null,
    tmdbVotes: d.vote_count || 0,
    imdbId,
    ...rating,
    spokenLanguages: d.spoken_languages.map((l) => l.english_name || l.name),
    productionCountries: d.production_countries.map((c) => c.iso_3166_1),
    productionCompanies: d.production_companies.map((c) => c.name),
    alternativeTitles: (
      d.alternative_titles?.titles ||
      d.alternative_titles?.results ||
      []
    ).map((t) => t.title),
    cast: (d.credits?.cast || [])
      .slice(0, 20)
      .map((p) => ({
        id: p.id,
        name: p.name,
        character: p.character || "",
        profilePath: p.profile_path || null,
      })),
    crew: (d.credits?.crew || [])
      .filter((p) =>
        ["Director", "Writer", "Screenplay", "Creator"].includes(p.job || ""),
      )
      .map((p) => ({ id: p.id, name: p.name, job: p.job })),
    trailer: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
    images: (d.images?.backdrops || []).slice(0, 8).map((i) => i.file_path),
    availability,
    metadataUpdatedAt: new Date().toISOString(),
    tv:
      type === "tv"
        ? {
            seasons: d.number_of_seasons || 0,
            episodes: d.number_of_episodes || 0,
            status: d.status || "",
            lastAirDate: d.last_air_date || "",
            networks: (d.networks || []).map((n) => n.name),
            seasonDetails: (d.seasons || []).map((s) => ({
              number: s.season_number,
              name: s.name,
              episodes: s.episode_count,
              airDate: s.air_date || "",
              posterPath: s.poster_path || null,
            })),
          }
        : null,
  });
}
