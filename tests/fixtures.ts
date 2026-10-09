import {
  mediaSchema,
  type Media,
  type SearchResult,
  type LibraryMedia,
} from "@/types";
export function fixture(id = 911, language = "ta", title = "Vikram"): Media {
  return mediaSchema.parse({
    id: `movie:${id}`,
    tmdbId: id,
    mediaType: "movie",
    title,
    originalTitle: title,
    originalLanguage: language,
    releaseDate: "2022-06-03",
    posterPath: null,
    backdropPath: null,
    overview: "An action thriller.",
    genres: [
      { id: 28, name: "Action" },
      { id: 53, name: "Thriller" },
    ],
    runtime: 175,
    tmdbRating: 7.7,
    tmdbVotes: 100,
    imdbId: "tt9179430",
    imdbRating: 8.3,
    imdbVotes: 10000,
    ratingsState: "available",
    spokenLanguages: ["Tamil"],
    productionCountries: ["IN"],
    productionCompanies: [],
    alternativeTitles: [],
    tagline: "",
    cast: [],
    crew: [],
    trailer: null,
    images: [],
    availability: {
      country: "IN",
      link: "https://www.themoviedb.org/movie/911/watch",
      groups: { flatrate: [{ id: 8, name: "Netflix", logoPath: null }] },
      checkedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 21600000).toISOString(),
      state: "available",
    },
    metadataUpdatedAt: new Date().toISOString(),
    tv: null,
  });
}
export function row(id = 911, language = "ta", title = "Vikram"): LibraryMedia {
  return {
    ...fixture(id, language, title),
    entry: {
      id: `movie:${id}`,
      mediaId: `movie:${id}`,
      watchStatus: "To Watch",
      dateAdded: "2026-10-01T00:00:00Z",
      dateWatched: null,
      personalRating: null,
      notes: "",
      isFavorite: false,
      rewatchCount: 0,
      updatedAt: "2026-10-01T00:00:00Z",
    },
  };
}
export function result(
  id = 911,
  language = "ta",
  title = "Vikram",
): SearchResult {
  const m = fixture(id, language, title);
  return { ...m, genreIds: m.genres.map((g) => g.id), popularity: 20 };
}
