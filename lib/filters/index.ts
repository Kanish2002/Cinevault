import type { LibraryMedia, SearchResult } from "@/types";
export type Filters = {
  query?: string;
  language?: string;
  genre?: string;
  status?: string;
  type?: string;
  provider?: string;
  favorite?: boolean;
  listIds?: string[];
  year?: string;
  decade?: string;
  runtime?: string;
  imdb?: string;
  tmdb?: string;
  country?: string;
};
export function filterLibrary(rows: LibraryMedia[], f: Filters) {
  return rows.filter(
    (m) =>
      (!f.query ||
        `${m.title} ${m.originalTitle}`
          .toLocaleLowerCase()
          .includes(f.query.toLocaleLowerCase())) &&
      (!f.language || m.originalLanguage === f.language) &&
      (!f.genre || m.genres.some((g) => g.name === f.genre)) &&
      (!f.status || m.entry.watchStatus === f.status) &&
      (!f.type || m.mediaType === f.type) &&
      (!f.favorite || m.entry.isFavorite) &&
      (!f.listIds || f.listIds.includes(m.id)) &&
      (!f.year || m.releaseDate.startsWith(f.year)) &&
      (!f.decade ||
        Math.floor(Number(m.releaseDate.slice(0, 4)) / 10) * 10 ===
          Number(f.decade)) &&
      (!f.runtime ||
        (m.runtime !== null &&
          (f.runtime === "short" ? m.runtime < 120 : m.runtime >= 120))) &&
      (!f.imdb || (m.imdbRating !== null && m.imdbRating >= Number(f.imdb))) &&
      (!f.tmdb || (m.tmdbRating !== null && m.tmdbRating >= Number(f.tmdb))) &&
      (!f.country || m.productionCountries.includes(f.country)) &&
      (!f.provider ||
        (m.availability?.state === "available" &&
          Date.parse(m.availability.expiresAt) > Date.now() &&
          Object.values(m.availability.groups)
            .flat()
            .some((p) => p.name === f.provider))),
  );
}
export function sortLibrary(rows: LibraryMedia[], sort: string) {
  return [...rows].sort((a, b) => {
    switch (sort) {
      case "title":
        return a.title.localeCompare(b.title);
      case "title-desc":
        return b.title.localeCompare(a.title);
      case "imdb":
        return (b.imdbRating ?? -1) - (a.imdbRating ?? -1);
      case "tmdb":
        return (b.tmdbRating ?? -1) - (a.tmdbRating ?? -1);
      case "newest":
        return b.releaseDate.localeCompare(a.releaseDate);
      case "oldest":
        return a.releaseDate.localeCompare(b.releaseDate);
      case "shortest":
        return (a.runtime ?? Infinity) - (b.runtime ?? Infinity);
      case "longest":
        return (b.runtime ?? -1) - (a.runtime ?? -1);
      case "personal":
        return (b.entry.personalRating ?? -1) - (a.entry.personalRating ?? -1);
      case "watched":
        return (b.entry.dateWatched || "").localeCompare(
          a.entry.dateWatched || "",
        );
      default:
        return b.entry.dateAdded.localeCompare(a.entry.dateAdded);
    }
  });
}
export function recommendationScore(
  result: SearchResult,
  rows: LibraryMedia[],
  preferred: string[],
) {
  if (rows.some((m) => m.id === result.id)) return -1;
  const liked = rows.filter(
    (m) => m.entry.isFavorite || (m.entry.personalRating ?? 0) >= 7,
  );
  return (
    (preferred.includes(result.originalLanguage) ? 3 : 0) +
    liked.reduce(
      (s, m) =>
        s +
        (m.originalLanguage === result.originalLanguage ? 1 : 0) +
        m.genres.filter((g) => result.genreIds.includes(g.id)).length,
      0,
    ) +
    (result.tmdbRating ?? 0) / 5
  );
}
export const smartCollections = (rows: LibraryMedia[]) => [
  ...Array.from(new Set(rows.map((m) => m.originalLanguage))).map((code) => ({
    id: `lang:${code}`,
    name: code,
    kind: "language",
    rows: rows.filter((m) => m.originalLanguage === code),
  })),
  ...Array.from(new Set(rows.flatMap((m) => m.genres.map((g) => g.name)))).map(
    (name) => ({
      id: `genre:${name}`,
      name,
      kind: "genre",
      rows: rows.filter((m) => m.genres.some((g) => g.name === name)),
    }),
  ),
  {
    id: "imdb8",
    name: "IMDb 8+",
    kind: "smart",
    rows: rows.filter((m) => (m.imdbRating ?? 0) >= 8),
  },
  {
    id: "unwatched",
    name: "Unwatched",
    kind: "smart",
    rows: rows.filter(
      (m) =>
        m.entry.watchStatus !== "Watched" && m.entry.watchStatus !== "Dropped",
    ),
  },
  {
    id: "month",
    name: "Watched this month",
    kind: "smart",
    rows: rows.filter((m) =>
      m.entry.dateWatched?.startsWith(new Date().toISOString().slice(0, 7)),
    ),
  },
  {
    id: "recent",
    name: "Recently added",
    kind: "smart",
    rows: sortLibrary(rows, "added").slice(0, 20),
  },
  {
    id: "released",
    name: "Recently released",
    kind: "smart",
    rows: rows.filter(
      (m) =>
        Date.parse(m.releaseDate) > Date.now() - 365 * 86400000 &&
        Date.parse(m.releaseDate) <= Date.now(),
    ),
  },
  {
    id: "under2",
    name: "Under two hours",
    kind: "smart",
    rows: rows.filter((m) => m.runtime !== null && m.runtime < 120),
  },
  {
    id: "over2",
    name: "Two hours or more",
    kind: "smart",
    rows: rows.filter((m) => m.runtime !== null && m.runtime >= 120),
  },
  ...Array.from(
    new Set(
      rows.flatMap((m) =>
        Object.values(m.availability?.groups || {})
          .flat()
          .map((p) => p.name),
      ),
    ),
  ).map((name) => ({
    id: `provider:${name}`,
    name: `On ${name}`,
    kind: "smart",
    rows: filterLibrary(rows, { provider: name }),
  })),
];
