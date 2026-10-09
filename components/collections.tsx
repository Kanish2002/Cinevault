"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Layers3,
  Plus,
  ArrowLeft,
  Trash2,
  Pencil,
  ArrowUp,
  ArrowDown,
  Film,
} from "lucide-react";
import Link from "next/link";
import {
  db,
  saveList,
  deleteList,
  listMembership,
  reorderItem,
} from "@/lib/db";
import { smartCollections, sortLibrary } from "@/lib/filters";
import { useLibrary } from "./providers";
import { MovieGrid } from "./movie-card";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { languageName, poster, errorMessage } from "@/lib/utils";
import type { CustomList } from "@/types";
export function CollectionsPage() {
  const { rows, toast } = useLibrary();
  const lists = useLiveQuery(() => db.lists.toArray(), []),
    items = useLiveQuery(() => db.items.toArray(), []);
  const [selected, setSelected] = useState(""),
    [editing, setEditing] = useState<CustomList | null>(null),
    [open, setOpen] = useState(false),
    [deleting, setDeleting] = useState(false),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [cover, setCover] = useState(""),
    [sort, setSort] = useState("position"),
    [filter, setFilter] = useState("");
  const smart = smartCollections(rows),
    list = lists?.find((l) => l.id === selected),
    collection = smart.find((s) => s.id === selected);
  const selectedItems = (items || [])
    .filter((i) => i.listId === selected)
    .sort((a, b) => a.position - b.position);
  const movies = list
    ? selectedItems.flatMap((i) => {
        const m = rows.find((m) => m.id === i.mediaId);
        return m ? [m] : [];
      })
    : collection?.rows || [];
  const shown = (
    sort === "position" ? movies : sortLibrary(movies, sort)
  ).filter((m) => m.title.toLowerCase().includes(filter.toLowerCase()));
  function edit(l?: CustomList) {
    setEditing(l || null);
    setName(l?.name || "");
    setDescription(l?.description || "");
    setCover(l?.coverImage || "");
    setOpen(true);
  }
  async function submit() {
    if (!name.trim()) return;
    try {
      const id = await saveList(
        { name: name.trim(), description, coverImage: cover || null },
        editing?.id,
      );
      setOpen(false);
      toast(editing ? "List updated" : "List created");
      setSelected(id);
    } catch (e) {
      toast(errorMessage(e));
    }
  }
  return (
    <>
      <div className="page-heading heading-with-action">
        <div>
          <div className="eyebrow">A LITTLE ORDER. A LOT OF POSSIBILITIES.</div>
          <h1>
            Your personal <em>collections.</em>
          </h1>
          <p>
            Make your own lists. Let languages and genres organize themselves.
          </p>
        </div>
        <Button onClick={() => edit()}>
          <Plus size={17} />
          New list
        </Button>
      </div>
      {selected ? (
        <>
          <div className="collection-detail-bar">
            <Button variant="ghost" onClick={() => setSelected("")}>
              <ArrowLeft size={17} />
              All collections
            </Button>
            {list && (
              <>
                <Button variant="outline" onClick={() => edit(list)}>
                  <Pencil size={15} />
                  Edit list
                </Button>
                <Button variant="ghost" onClick={() => setDeleting(true)}>
                  <Trash2 size={16} />
                  Delete list
                </Button>
              </>
            )}
          </div>
          <div className="section-title">
            <div>
              <h2>
                {list?.name ||
                  (collection?.kind === "language"
                    ? `${languageName(collection.name)} stories`
                    : collection?.name)}
              </h2>
              <p>
                {list?.description ||
                  "A dynamic collection, automatically updated."}
              </p>
            </div>
            <span className="muted">{movies.length} stories</span>
          </div>
          <div className="library-toolbar">
            <input
              aria-label="Filter list titles"
              placeholder="Filter this list"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <select
              aria-label="Sort list"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="position">Your order</option>
              <option value="title">Title A–Z</option>
              <option value="imdb">Highest IMDb</option>
              <option value="newest">Newest releases</option>
            </select>
          </div>
          {shown.length ? (
            <>
              <MovieGrid movies={shown} />
              {list && (
                <div className="reorder-list">
                  <h3>Manage list order</h3>
                  {selectedItems.map((i, index) => {
                    const m = rows.find((m) => m.id === i.mediaId);
                    return (
                      m && (
                        <div key={i.id}>
                          <Link href={`/media/${m.mediaType}/${m.tmdbId}`}>
                            {index + 1}. {m.title}
                          </Link>
                          <div>
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={index === 0}
                              aria-label={`Move ${m.title} up`}
                              onClick={() =>
                                void reorderItem(i.id, -1).catch((e) =>
                                  toast(errorMessage(e)),
                                )
                              }
                            >
                              <ArrowUp size={17} />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={index === selectedItems.length - 1}
                              aria-label={`Move ${m.title} down`}
                              onClick={() =>
                                void reorderItem(i.id, 1).catch((e) =>
                                  toast(errorMessage(e)),
                                )
                              }
                            >
                              <ArrowDown size={17} />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Remove ${m.title} from list`}
                              onClick={() =>
                                void listMembership(list.id, m.id, false).catch(
                                  (e) => toast(errorMessage(e)),
                                )
                              }
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </div>
                      )
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <Layers3 size={40} />
              <h2>A collection waiting to happen.</h2>
              <p>
                Open a saved title and choose this list under “Add to list”.
              </p>
              <Button
                onClick={() =>
                  window.dispatchEvent(new Event("cinevault-search"))
                }
              >
                Find a movie
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="section-title">
            <div>
              <h2>
                Made by you<span className="heading-dot">.</span>
              </h2>
              <p>
                Weekend plans, timeless favorites, and everything in between.
              </p>
            </div>
          </div>
          <div className="collection-grid">
            {lists?.map((l) => {
              const ids = (items || [])
                  .filter((i) => i.listId === l.id)
                  .map((i) => i.mediaId),
                first = rows.find((m) => ids.includes(m.id));
              const image = l.coverImage || first?.posterPath;
              return (
                <button
                  key={l.id}
                  className="collection-tile"
                  onClick={() => setSelected(l.id)}
                >
                  {image ? (
                    <img src={poster(image, "w500")!} alt="" loading="lazy" />
                  ) : (
                    <div className="collection-art">
                      <Film size={52} />
                    </div>
                  )}
                  <div>
                    <span>CUSTOM LIST · {ids.length} STORIES</span>
                    <h3>{l.name}</h3>
                    <p>{l.description || "A collection of your own."}</p>
                  </div>
                </button>
              );
            })}
            <button className="collection-create" onClick={() => edit()}>
              <Plus size={32} />
              <strong>Create a new list</strong>
              <span>Your next movie night, organized.</span>
            </button>
          </div>
          <div className="section-title">
            <div>
              <h2>
                Collected automatically<span className="heading-dot">.</span>
              </h2>
              <p>One library, many ways to explore it.</p>
            </div>
          </div>
          <div className="smart-grid">
            {smart
              .filter((s) => s.rows.length > 0)
              .map((s) => (
                <button
                  key={s.id}
                  className="smart-tile"
                  onClick={() => setSelected(s.id)}
                >
                  <span className="smart-icon">
                    {s.kind === "language"
                      ? "文"
                      : s.kind === "genre"
                        ? "✳"
                        : "◈"}
                  </span>
                  <div>
                    <h3>
                      {s.kind === "language"
                        ? `${languageName(s.name)} stories`
                        : s.name}
                    </h3>
                    <p>
                      {s.rows.length} stories · {s.kind}
                    </p>
                  </div>
                  <ArrowUp size={18} className="rotate-arrow" />
                </button>
              ))}
          </div>
          {!rows.length && (
            <p className="muted">
              Language, genre, runtime, and rating collections appear
              automatically as you save titles.
            </p>
          )}
        </>
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit your list" : "Make room for a new collection"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="form-stack"
        >
          <label>
            List name
            <input
              autoFocus
              maxLength={100}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Weekend movies"
            />
          </label>
          <label>
            Description
            <textarea
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="The perfect stories for a slow Sunday."
            />
          </label>
          <label>
            Cover
            <select value={cover} onChange={(e) => setCover(e.target.value)}>
              <option value="">Automatic cover</option>
              {rows
                .filter((m) => m.posterPath)
                .map((m) => (
                  <option value={m.posterPath!} key={m.id}>
                    {m.title}
                  </option>
                ))}
            </select>
          </label>
          <Button type="submit" disabled={!name.trim()}>
            {editing ? "Save changes" : "Create list"}
          </Button>
        </form>
      </Dialog>
      <Dialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this list?"
      >
        <p>Your saved movies will stay in your collection.</p>
        <Button
          variant="destructive"
          onClick={() => {
            void deleteList(selected)
              .then(() => {
                setSelected("");
                setDeleting(false);
                toast("List deleted. Your movies are safe.");
              })
              .catch((e) => toast(errorMessage(e)));
          }}
        >
          Delete list
        </Button>
      </Dialog>
    </>
  );
}
