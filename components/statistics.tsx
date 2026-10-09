"use client";
import { useLibrary } from "./providers";
import { languageName } from "@/lib/utils";
import { MovieGrid } from "./movie-card";
import { sortLibrary } from "@/lib/filters";
function counts(values: string[]) {
  const map = new Map<string, number>();
  for (const v of values) if (v) map.set(v, (map.get(v) || 0) + 1);
  return Array.from(map).sort((a, b) => b[1] - a[1]);
}
function Bars({ title, data }: { title: string; data: [string, number][] }) {
  const max = Math.max(1, ...data.map((d) => d[1]));
  return (
    <section className="stat-panel">
      <h2>{title}</h2>
      {data.length ? (
        <div className="bar-chart">
          {data.slice(0, 12).map(([label, n]) => (
            <div key={label}>
              <div>
                <span>{label}</span>
                <strong>{n}</strong>
              </div>
              <div className="bar-track">
                <div style={{ width: `${(n / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No recorded data yet.</p>
      )}
    </section>
  );
}
export function StatisticsPage() {
  const { rows } = useLibrary();
  const watched = rows.filter((m) => m.entry.watchStatus === "Watched"),
    ratings = rows.flatMap((m) =>
      m.entry.personalRating !== null ? [m.entry.personalRating] : [],
    );
  const runtime = watched
    .filter((m) => m.mediaType === "movie" && m.runtime !== null)
    .reduce((s, m) => s + m.runtime! * (1 + m.entry.rewatchCount), 0);
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">THE BIG PICTURE</div>
        <h1>
          A life in <em>stories.</em>
        </h1>
        <p>
          Every number comes from your collection and the details you’ve
          recorded.
        </p>
      </div>
      <div className="stats-metrics">
        {[
          ["Saved movies", rows.filter((m) => m.mediaType === "movie").length],
          ["Saved series", rows.filter((m) => m.mediaType === "tv").length],
          [
            "To watch",
            rows.filter((m) => m.entry.watchStatus === "To Watch").length,
          ],
          [
            "Watching",
            rows.filter((m) => m.entry.watchStatus === "Watching").length,
          ],
          ["Watched", watched.length],
          ["Favorites", rows.filter((m) => m.entry.isFavorite).length],
          [
            "Average personal rating",
            ratings.length
              ? (ratings.reduce((s, n) => s + n, 0) / ratings.length).toFixed(1)
              : "—",
          ],
          ["Movie hours watched", (runtime / 60).toFixed(1)],
        ].map(([label, value]) => (
          <div className="stat-number" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <p className="attribution">
        Runtime includes recorded movie rewatches with known runtimes. TV
        episode viewing progress is not inferred.
      </p>
      <div className="stats-grid">
        <Bars
          title="Original languages"
          data={counts(rows.map((m) => languageName(m.originalLanguage)))}
        />
        <Bars
          title="Favorite genres"
          data={counts(
            rows
              .filter(
                (m) => m.entry.isFavorite || (m.entry.personalRating ?? 0) >= 7,
              )
              .flatMap((m) => m.genres.map((g) => g.name)),
          )}
        />
        <Bars
          title="Watched by month"
          data={counts(
            watched.map((m) => m.entry.dateWatched?.slice(0, 7) || ""),
          ).sort((a, b) => a[0].localeCompare(b[0]))}
        />
        <Bars
          title="Watched by year"
          data={counts(
            watched.map((m) => m.entry.dateWatched?.slice(0, 4) || ""),
          ).sort((a, b) => a[0].localeCompare(b[0]))}
        />
        <Bars
          title="Personal rating distribution"
          data={counts(ratings.map((r) => String(Math.floor(r)) + "/10")).sort(
            (a, b) => parseInt(a[0]) - parseInt(b[0]),
          )}
        />
        <Bars
          title="Most watched decades"
          data={counts(
            watched
              .filter((m) => m.releaseDate)
              .map(
                (m) =>
                  `${Math.floor(Number(m.releaseDate.slice(0, 4)) / 10) * 10}s`,
              ),
          )}
        />
      </div>
      {watched.length > 0 && (
        <section>
          <div className="section-title">
            <h2>
              Recently watched<span className="heading-dot">.</span>
            </h2>
          </div>
          <MovieGrid movies={sortLibrary(watched, "watched").slice(0, 6)} />
        </section>
      )}
    </>
  );
}
