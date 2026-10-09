"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Compass, RefreshCw } from "lucide-react";
import { api, errorMessage } from "@/lib/utils";
import type { SearchResult } from "@/types";
import { useLibrary } from "./providers";
import { MovieGrid } from "./movie-card";
import { Button } from "./ui/button";
import { recommendationScore } from "@/lib/filters";
export function DiscoveryFeed({
  kind,
  language = "ta",
  genre = "",
  limit,
}: {
  kind: string;
  language?: string;
  genre?: string;
  limit?: number;
}) {
  const { rows, prefs } = useLibrary();
  const [data, setData] = useState<SearchResult[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(1);
  const seed = useMemo(
    () =>
      [...rows]
        .sort(
          (a, b) =>
            Number(b.entry.isFavorite) - Number(a.entry.isFavorite) ||
            (b.entry.personalRating ?? 0) - (a.entry.personalRating ?? 0),
        )
        .slice(0, 3)
        .map((m) => ({ id: m.tmdbId, type: m.mediaType })),
    [rows],
  );
  const seedKey = JSON.stringify(seed);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError("");
    (async () => {
      try {
        let results: SearchResult[] = [];
        if (kind === "recommended") {
          const parsed = JSON.parse(seedKey) as { id: number; type: string }[];
          if (parsed.length) {
            const pages = await Promise.all(
              parsed.map((s) =>
                api<{ results: SearchResult[] }>(
                  `/api/recommendations?type=${s.type}&id=${s.id}`,
                  { signal: c.signal },
                ),
              ),
            );
            results = Array.from(
              new Map(
                pages.flatMap((p) => p.results).map((r) => [r.id, r]),
              ).values(),
            );
          } else {
            results = (
              await api<{ results: SearchResult[] }>(
                "/api/discover?kind=regional&language=" + language,
                { signal: c.signal },
              )
            ).results;
          }
        } else {
          const d = await api<{ results: SearchResult[]; totalPages: number }>(
            `/api/discover?kind=${kind}&language=${language}&genre=${genre}&page=${page}`,
            { signal: c.signal },
          );
          results = d.results;
          setTotal(d.totalPages);
        }
        if (!c.signal.aborted) setData(results);
      } catch (e) {
        if (!c.signal.aborted) setError(errorMessage(e));
      } finally {
        if (!c.signal.aborted) setLoading(false);
      }
    })();
    return () => c.abort();
  }, [kind, language, genre, page, retry, seedKey]);
  const visible =
    kind === "recommended"
      ? data
          .filter(
            (r) => recommendationScore(r, rows, prefs.languagePreferences) >= 0,
          )
          .sort(
            (a, b) =>
              recommendationScore(b, rows, prefs.languagePreferences) -
              recommendationScore(a, rows, prefs.languagePreferences),
          )
      : data;
  if (loading)
    return (
      <div className="skeleton-grid" aria-label="Loading movies">
        {Array.from({ length: limit || 6 }, (_, i) => (
          <div key={i} />
        ))}
      </div>
    );
  if (error)
    return (
      <div className="api-empty">
        <Compass size={26} />
        <div>
          <h3>Discovery is taking a short intermission.</h3>
          <p>{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRetry((r) => r + 1)}
          >
            <RefreshCw size={14} />
            Try again
          </Button>
        </div>
      </div>
    );
  return (
    <>
      {!visible.length ? (
        <p className="muted">
          No new recommendations yet. Add a few favorites or try another
          discovery category.
        </p>
      ) : (
        <MovieGrid movies={limit ? visible.slice(0, limit) : visible} />
      )}{" "}
      {!limit && kind !== "recommended" && (
        <div className="pagination">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page} of {total}
          </span>
          <Button
            variant="outline"
            disabled={page >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </>
  );
}
export function DiscoverPage() {
  const p = useSearchParams();
  const [kind, setKind] = useState(p.get("kind") || "trending"),
    [language, setLanguage] = useState("ta"),
    [genre, setGenre] = useState("");
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">A WORLD OF STORIES</div>
        <h1>
          Discover something <em>great.</em>
        </h1>
        <p>From global favorites to the best of regional cinema.</p>
      </div>
      <div className="tabs">
        {[
          ["trending", "Trending"],
          ["popular", "Popular"],
          ["top", "Top rated"],
          ["upcoming", "Upcoming"],
          ["tv", "TV series"],
          ["regional", "Regional gems"],
          ["genre", "By genre"],
          ["recommended", "For you"],
        ].map(([k, label]) => (
          <button
            key={k}
            className={kind === k ? "active" : ""}
            onClick={() => setKind(k)}
          >
            {label}
          </button>
        ))}
      </div>
      {(kind === "regional" || kind === "genre") && (
        <div className="inline-filters">
          <label>
            Original language
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {[
                ["ta", "Tamil"],
                ["en", "English"],
                ["te", "Telugu"],
                ["ml", "Malayalam"],
                ["hi", "Hindi"],
                ["kn", "Kannada"],
                ["ko", "Korean"],
                ["ja", "Japanese"],
                ["fr", "French"],
                ["es", "Spanish"],
              ].map(([v, t]) => (
                <option value={v} key={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          {kind === "genre" && (
            <label>
              Genre
              <select value={genre} onChange={(e) => setGenre(e.target.value)}>
                <option value="">All genres</option>
                {[
                  ["28", "Action"],
                  ["35", "Comedy"],
                  ["18", "Drama"],
                  ["27", "Horror"],
                  ["10749", "Romance"],
                  ["878", "Science fiction"],
                  ["53", "Thriller"],
                  ["16", "Animation"],
                ].map(([v, t]) => (
                  <option value={v} key={v}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      <DiscoveryFeed
        key={`${kind}/${language}/${genre}`}
        kind={kind}
        language={language}
        genre={genre}
      />
    </>
  );
}
