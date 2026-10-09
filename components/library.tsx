"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SlidersHorizontal, Search, Bookmark, Plus, X } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, savePreferences } from "@/lib/db";
import { useLibrary } from "./providers";
import { MovieGrid } from "./movie-card";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { filterLibrary, sortLibrary, type Filters } from "@/lib/filters";
import { languageName } from "@/lib/utils";
import { statuses } from "@/types";
export function LibraryPage({ watched = false }: { watched?: boolean }) {
  const { rows, prefs, loading } = useLibrary();
  const params = useSearchParams();
  const [f, setF] = useState<Filters>({
      language: params.get("language") || "",
      favorite: params.get("favorite") === "1",
    }),
    [sort, setSort] = useState(prefs.defaultSort),
    [open, setOpen] = useState(false),
    [selectedList, setSelectedList] = useState("");
  const lists = useLiveQuery(() => db.lists.toArray(), []),
    items = useLiveQuery(() => db.items.toArray(), []);
  const values = (
    key: "language" | "genre" | "provider" | "country" | "year" | "decade",
  ) =>
    Array.from(
      new Set(
        rows.flatMap((m) =>
          key === "language"
            ? [m.originalLanguage]
            : key === "genre"
              ? m.genres.map((g) => g.name)
              : key === "provider"
                ? Object.values(m.availability?.groups || {})
                    .flat()
                    .map((p) => p.name)
                : key === "country"
                  ? m.productionCountries
                  : key === "year"
                    ? [m.releaseDate.slice(0, 4)].filter(Boolean)
                    : m.releaseDate
                      ? [
                          String(
                            Math.floor(Number(m.releaseDate.slice(0, 4)) / 10) *
                              10,
                          ),
                        ]
                      : [],
        ),
      ),
    ).sort();
  const base = rows.filter((m) =>
    watched
      ? m.entry.watchStatus === "Watched"
      : m.entry.watchStatus !== "Watched",
  );
  const visible = useMemo(
    () =>
      sortLibrary(
        filterLibrary(base, {
          ...f,
          listIds: selectedList
            ? (items || [])
                .filter((i) => i.listId === selectedList)
                .map((i) => i.mediaId)
            : undefined,
        }),
        sort,
      ),
    [base, f, sort, items, selectedList],
  );
  const set = (key: keyof Filters, value: string | boolean) =>
    setF((f) => ({ ...f, [key]: value }));
  useEffect(() => {
    setSort(prefs.defaultSort);
  }, [prefs.defaultSort]);
  const filterControls = (
    <div className="filter-controls">
      {[
        {
          key: "language",
          label: "Original language",
          options: values("language").map((v) => [v, languageName(v)]),
        },
        {
          key: "genre",
          label: "Genre",
          options: values("genre").map((v) => [v, v]),
        },
        {
          key: "status",
          label: "Watch status",
          options: statuses.map((v) => [v, v]),
        },
        {
          key: "type",
          label: "Media type",
          options: [
            ["movie", "Movies"],
            ["tv", "TV series"],
          ],
        },
        {
          key: "provider",
          label: "OTT platform",
          options: values("provider").map((v) => [v, v]),
        },
        {
          key: "year",
          label: "Release year",
          options: values("year")
            .reverse()
            .map((v) => [v, v]),
        },
        {
          key: "decade",
          label: "Decade",
          options: values("decade")
            .reverse()
            .map((v) => [v, v + "s"]),
        },
        {
          key: "runtime",
          label: "Runtime",
          options: [
            ["short", "Under 2 hours"],
            ["long", "2 hours or more"],
          ],
        },
        {
          key: "imdb",
          label: "IMDb minimum",
          options: ["6", "7", "8", "9"].map((v) => [v, v + "+"]),
        },
        {
          key: "tmdb",
          label: "TMDB minimum",
          options: ["6", "7", "8", "9"].map((v) => [v, v + "+"]),
        },
        {
          key: "country",
          label: "Production country",
          options: values("country").map((v) => [v, v]),
        },
      ].map((field) => (
        <label key={field.key}>
          {field.label}
          <select
            value={String(f[field.key as keyof Filters] || "")}
            onChange={(e) => set(field.key as keyof Filters, e.target.value)}
          >
            <option value="">All</option>
            {field.options.map(([v, label]) => (
              <option value={v} key={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label>
        Custom list
        <select
          value={selectedList}
          onChange={(e) => setSelectedList(e.target.value)}
        >
          <option value="">All lists</option>
          {lists?.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={!!f.favorite}
          onChange={(e) => set("favorite", e.target.checked)}
        />
        Favorites only
      </label>
      <Button
        variant="ghost"
        onClick={() => {
          setF({});
          setSelectedList("");
        }}
      >
        Reset filters <X size={16} />
      </Button>
    </div>
  );
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">YOUR PERSONAL CINEMA</div>
        <h1>
          {watched ? "Stories you’ve" : "Your next"}{" "}
          <em>{watched ? "experienced." : "great watch."}</em>
        </h1>
        <p>
          {watched
            ? "Every watched title, rating, and memory in one place."
            : "All the movies and series you’ve been meaning to get around to."}
        </p>
      </div>
      <div className="library-toolbar">
        <div className="collection-search">
          <Search size={17} />
          <input
            aria-label="Search saved collection"
            placeholder="Search your collection"
            value={f.query || ""}
            onChange={(e) => set("query", e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={() => setOpen(true)}>
          <SlidersHorizontal size={17} />
          Filters{" "}
          {Object.values(f).filter(Boolean).length > 0 && (
            <span className="filter-count">
              {Object.values(f).filter(Boolean).length}
            </span>
          )}
        </Button>
        <select
          aria-label="Sort collection"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            void savePreferences({ defaultSort: e.target.value });
          }}
        >
          {[
            ["added", "Recently added"],
            ["watched", "Recently watched"],
            ["title", "Title A–Z"],
            ["title-desc", "Title Z–A"],
            ["imdb", "Highest IMDb"],
            ["tmdb", "Highest TMDB"],
            ["newest", "Newest releases"],
            ["oldest", "Oldest releases"],
            ["shortest", "Shortest runtime"],
            ["longest", "Longest runtime"],
            ["personal", "Personal rating"],
          ].map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="active-filters">
        <span>
          {visible.length} {visible.length === 1 ? "story" : "stories"}
        </span>
        {Object.entries(f)
          .filter(([k, v]) => v && k !== "query")
          .map(([k, v]) => (
            <button
              key={k}
              onClick={() => setF((f) => ({ ...f, [k]: undefined }))}
            >
              {k === "language"
                ? languageName(String(v))
                : v === true
                  ? "Favorites"
                  : String(v)}{" "}
              <X size={12} />
            </button>
          ))}
      </div>
      {loading ? (
        <div className="skeleton-row" />
      ) : visible.length ? (
        <MovieGrid movies={visible} />
      ) : (
        <div className="empty-state">
          <Bookmark size={40} />
          <h2>
            {base.length
              ? "No stories match these filters."
              : watched
                ? "Your first finished story belongs here."
                : "Your watchlist is waiting for its first story."}
          </h2>
          <p>
            {base.length
              ? "Try removing a filter or searching a different title."
              : "Search a title above and add it to your personal vault."}
          </p>
          <Button
            onClick={() =>
              base.length
                ? setF({})
                : window.dispatchEvent(new Event("cinevault-search"))
            }
          >
            <Plus size={17} />
            {base.length ? "Reset filters" : "Find a movie"}
          </Button>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen} title="Filter your collection">
        {filterControls}
        <Button className="full-width" onClick={() => setOpen(false)}>
          Show {visible.length} stories
        </Button>
      </Dialog>
    </>
  );
}
