"use client";
import Link from "next/link";
import { Heart, Plus, Check, Film, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useLibrary } from "./providers";
import { api, errorMessage, languageName, poster, year } from "@/lib/utils";
import { addMedia, updateEntry } from "@/lib/db";
import type { LibraryMedia, SearchResult, Media } from "@/types";
import { Button } from "./ui/button";
export function MovieCard({ movie }: { movie: LibraryMedia | SearchResult }) {
  const { rows, prefs, toast } = useLibrary();
  const entry =
    "entry" in movie ? movie.entry : rows.find((m) => m.id === movie.id)?.entry;
  const [busy, setBusy] = useState(false);
  async function add() {
    setBusy(true);
    try {
      const m = await api<Media>(
        `/api/media/${movie.mediaType}/${movie.tmdbId}?region=${prefs.preferredRegion}`,
      );
      toast(
        (await addMedia(m))
          ? `${m.title} added to your collection`
          : "Already saved. Your status is preserved.",
      );
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="movie-card">
      <div className="poster-wrap">
        <Link
          href={`/media/${movie.mediaType}/${movie.tmdbId}`}
          aria-label={`View ${movie.title}`}
          className="poster-link"
        >
          {poster(movie.posterPath) ? (
            <img
              src={poster(movie.posterPath)!}
              alt={`${movie.title} poster`}
              loading="lazy"
              width={342}
              height={513}
            />
          ) : (
            <div className="poster-fallback">
              <Film size={42} />
              <span>{movie.title}</span>
            </div>
          )}
        </Link>
        <span className="language-badge">
          {languageName(movie.originalLanguage)}
        </span>
        {entry && (
          <button
            className={`favorite-button ${entry.isFavorite ? "is-favorite" : ""}`}
            aria-label={`${entry.isFavorite ? "Unfavorite" : "Favorite"} ${movie.title}`}
            onClick={() =>
              void updateEntry(movie.id, {
                isFavorite: !entry.isFavorite,
              }).catch((e) => toast(errorMessage(e)))
            }
          >
            <Heart
              size={17}
              fill={entry.isFavorite ? "currentColor" : "none"}
            />
          </button>
        )}
        <div className="poster-bottom">
          {entry ? (
            <span
              className={`status-pill ${entry.watchStatus === "Watched" ? "done" : ""}`}
            >
              {entry.watchStatus === "Watched" && <Check size={12} />}{" "}
              {entry.watchStatus}
            </span>
          ) : (
            <span className="status-pill">
              {movie.mediaType === "tv" ? "TV SERIES" : "MOVIE"}
            </span>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="card-add"
            aria-label={
              entry
                ? `Mark ${movie.title} ${entry.watchStatus === "Watched" ? "To Watch" : "Watched"}`
                : `Add ${movie.title}`
            }
            disabled={busy}
            onClick={() =>
              entry
                ? void updateEntry(movie.id, {
                    watchStatus:
                      entry.watchStatus === "Watched" ? "To Watch" : "Watched",
                  }).catch((e) => toast(errorMessage(e)))
                : void add()
            }
          >
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : entry ? (
              <Check size={17} />
            ) : (
              <Plus size={17} />
            )}
          </Button>
        </div>
      </div>
      <div className="card-info">
        <Link href={`/media/${movie.mediaType}/${movie.tmdbId}`}>
          <h3>{movie.title}</h3>
        </Link>
        <div className="card-meta">
          <span>{year(movie.releaseDate)}</span>
          {"imdbRating" in movie && movie.imdbRating !== null ? (
            <span className="rating">
              <b>IMDb</b> {movie.imdbRating.toFixed(1)}
            </span>
          ) : movie.tmdbRating !== null ? (
            <span className="rating tmdb">
              <b>TMDB</b> {movie.tmdbRating.toFixed(1)}
            </span>
          ) : (
            <span>Unrated</span>
          )}
        </div>
      </div>
    </article>
  );
}
export function MovieGrid({
  movies,
}: {
  movies: (LibraryMedia | SearchResult)[];
}) {
  const [count, setCount] = useState(36);
  return (
    <>
      <div className="movie-grid">
        {movies.slice(0, count).map((m) => (
          <MovieCard key={m.id} movie={m} />
        ))}
      </div>
      {movies.length > count && (
        <div className="load-more">
          <Button variant="outline" onClick={() => setCount((c) => c + 36)}>
            Show more titles ({movies.length - count} remaining)
          </Button>
        </div>
      )}
    </>
  );
}
