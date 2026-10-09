import { z } from "zod";
export const statuses = [
  "To Watch",
  "Watching",
  "Watched",
  "On Hold",
  "Dropped",
] as const;
export type WatchStatus = (typeof statuses)[number];
export const mediaKey = (type: "movie" | "tv", id: number) => `${type}:${id}`;
const text = z.string().max(10000);
const personSchema = z.object({
  id: z.number(),
  name: text,
  character: text.optional(),
  job: text.optional(),
  profilePath: text.nullable().optional(),
});
const providerSchema = z.object({
  id: z.number(),
  name: text,
  logoPath: text.nullable(),
});
export const availabilitySchema = z.object({
  country: z.string().length(2),
  link: z.string().url().nullable(),
  groups: z.record(z.string(), z.array(providerSchema)),
  checkedAt: z.string(),
  expiresAt: z.string(),
  state: z.enum(["available", "unknown", "error"]),
  error: text.optional(),
});
export const mediaSchema = z.object({
  id: z.string(),
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(["movie", "tv"]),
  title: z.string().min(1).max(500),
  originalTitle: text,
  originalLanguage: z.string().max(20),
  releaseDate: text,
  posterPath: text.nullable(),
  backdropPath: text.nullable(),
  overview: text,
  genres: z.array(z.object({ id: z.number(), name: text })),
  runtime: z.number().nonnegative().nullable(),
  tmdbRating: z.number().min(0).max(10).nullable(),
  tmdbVotes: z.number().nonnegative(),
  imdbId: text.nullable(),
  imdbRating: z.number().min(0).max(10).nullable(),
  imdbVotes: z.number().nonnegative().nullable(),
  ratingsState: z.enum(["available", "unconfigured", "unavailable", "error"]),
  spokenLanguages: z.array(z.string()),
  productionCountries: z.array(z.string()),
  productionCompanies: z.array(z.string()),
  alternativeTitles: z.array(z.string()),
  tagline: text,
  cast: z.array(personSchema),
  crew: z.array(personSchema),
  trailer: z.string().nullable(),
  images: z.array(z.string()),
  availability: availabilitySchema.nullable(),
  metadataUpdatedAt: z.string(),
  tv: z
    .object({
      seasons: z.number(),
      episodes: z.number(),
      status: text,
      lastAirDate: text,
      networks: z.array(z.string()),
      seasonDetails: z.array(
        z.object({
          number: z.number(),
          name: text,
          episodes: z.number(),
          airDate: text,
          posterPath: text.nullable(),
        }),
      ),
    })
    .nullable(),
});
export type Media = z.infer<typeof mediaSchema>;
export const entrySchema = z.object({
  id: z.string(),
  mediaId: z.string(),
  watchStatus: z.enum(statuses),
  dateAdded: z.string(),
  dateWatched: z.string().nullable(),
  personalRating: z.number().min(0).max(10).nullable(),
  notes: text,
  isFavorite: z.boolean(),
  rewatchCount: z.number().int().nonnegative(),
  updatedAt: z.string(),
});
export type LibraryEntry = z.infer<typeof entrySchema>;
export const listSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(1000),
  coverImage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CustomList = z.infer<typeof listSchema>;
export const itemSchema = z.object({
  id: z.string(),
  listId: z.string(),
  mediaId: z.string(),
  position: z.number().int().nonnegative(),
  dateAdded: z.string(),
});
export type ListItem = z.infer<typeof itemSchema>;
export type LibraryMedia = Media & { entry: LibraryEntry };
export const prefsSchema = z.object({
  id: z.literal("main"),
  preferredRegion: z.string().regex(/^[A-Z]{2}$/),
  theme: z.enum(["dark", "light"]),
  defaultWatchStatus: z.enum(statuses),
  defaultSort: z.string(),
  languagePreferences: z.array(z.string()),
  voiceLanguage: z.string(),
  lastBackupAt: z.string().nullable(),
  syncEnabled: z.boolean(),
});
export type Preferences = z.infer<typeof prefsSchema>;
export const defaultPrefs: Preferences = {
  id: "main",
  preferredRegion: "IN",
  theme: "dark",
  defaultWatchStatus: "To Watch",
  defaultSort: "added",
  languagePreferences: ["ta", "en"],
  voiceLanguage: "en-IN",
  lastBackupAt: null,
  syncEnabled: false,
};
export type SearchResult = Pick<
  Media,
  | "id"
  | "tmdbId"
  | "mediaType"
  | "title"
  | "originalTitle"
  | "originalLanguage"
  | "releaseDate"
  | "posterPath"
  | "backdropPath"
  | "tmdbRating"
  | "overview"
> & { genreIds: number[]; popularity: number };
export type SyncKind = "media" | "entries" | "lists" | "items";
export type Outbox = {
  key: string;
  kind: SyncKind;
  recordId: string;
  payload: unknown;
  deleted: boolean;
  baseRevision: number;
  mutationId: string;
};
export type SyncRecord = {
  key: string;
  kind: SyncKind;
  recordId: string;
  payload: unknown;
  deleted: boolean;
  revision: number;
  sequence: number;
};
