'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  Bookmark,
  Check,
  Heart,
  RefreshCw,
  Play,
  Trash2,
  Plus,
  ExternalLink,
  Film,
} from 'lucide-react';
import { useLibrary } from './providers';
import { db, addMedia, refreshMedia, updateEntry, removeMedia, listMembership } from '@/lib/db';
import { api, errorMessage, languageName, poster, year } from '@/lib/utils';
import { statuses, mediaKey, type Media, type WatchStatus } from '@/types';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { MovieGrid } from './movie-card';
import type { SearchResult } from '@/types';
export function DetailPage({ type, id }: { type: 'movie' | 'tv'; id: number }) {
  const { rows, prefs, toast } = useLibrary();
  const key = mediaKey(type, id),
    saved = rows.find((m) => m.id === key);
  const [remote, setRemote] = useState<Media | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [listOpen, setListOpen] = useState(false),
    [removeOpen, setRemoveOpen] = useState(false),
    [notes, setNotes] = useState(''),
    [similar, setSimilar] = useState<SearchResult[]>([]);
  const lists = useLiveQuery(() => db.lists.toArray(), []),
    items = useLiveQuery(() => db.items.where('mediaId').equals(key).toArray(), [key]);
  const media = saved || remote;
  const [membershipOverrides, setMembershipOverrides] = useState<Record<string, boolean>>({});
  function setMembership(listId: string, included: boolean) {
    setMembershipOverrides((previous) => ({ ...previous, [listId]: included }));
    void listMembership(listId, key, included).catch((e) => {
      setMembershipOverrides((previous) => {
        const next = { ...previous };
        delete next[listId];
        return next;
      });
      toast(errorMessage(e));
    });
  }
  useEffect(() => {
    const c = new AbortController();
    (async () => {
      const cached = await db.media.get(key);
      if (cached && !c.signal.aborted) setRemote(cached);
      if (cached && Date.parse(cached.metadataUpdatedAt) > Date.now() - 86400000) return;
      if (!navigator.onLine) {
        if (!cached)
          setError('This title has not been saved for offline access. Reconnect to load it.');
        return;
      }
      try {
        const m = await api<Media>(`/api/media/${type}/${id}?region=${prefs.preferredRegion}`, {
          signal: c.signal,
        });
        if (!c.signal.aborted) {
          setRemote(m);
          if (await db.entries.get(key)) await refreshMedia(m);
        }
      } catch (e) {
        if (!c.signal.aborted) setError(errorMessage(e));
      }
    })();
    return () => c.abort();
  }, [key, type, id, prefs.preferredRegion]);
  useEffect(() => {
    setNotes(saved?.entry.notes || '');
  }, [saved?.entry.notes]);
  useEffect(() => {
    const c = new AbortController();
    api<{ results: SearchResult[] }>(`/api/discover?kind=similar&type=${type}&id=${id}`, {
      signal: c.signal,
    })
      .then((d) => setSimilar(d.results.slice(0, 6)))
      .catch(() => {});
    return () => c.abort();
  }, [type, id]);
  async function action(work: () => Promise<unknown>, message?: string) {
    setBusy(true);
    try {
      await work();
      if (message) toast(message);
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    await action(async () => {
      const m = await api<Media>(
        `/api/media/${type}/${id}?region=${prefs.preferredRegion}&refresh=1`,
      );
      setRemote(m);
      if (saved) await refreshMedia(m);
    }, 'Metadata checked. Availability can be delayed by the source.');
  }
  if (!media)
    return (
      <div className="empty-state">
        <Film size={40} />
        <h2>{error ? 'This story needs a moment.' : 'Loading the story…'}</h2>
        <p role={error ? 'alert' : undefined}>{error || 'Retrieving movie details.'}</p>
        {error && (
          <Button onClick={() => void refresh()}>
            <RefreshCw size={16} />
            Retry
          </Button>
        )}
      </div>
    );
  const providers = media.availability;
  return (
    <>
      <Link href="/watchlist" className="text-link">
        <ArrowLeft size={16} />
        Back to my collection
      </Link>
      {error && (
        <p className="inline-error" role="alert">
          Showing saved details. {error}
        </p>
      )}
      <div className="detail-hero">
        {poster(media.backdropPath, 'w1280') && (
          <img className="detail-backdrop" src={poster(media.backdropPath, 'w1280')!} alt="" />
        )}
        <div className="detail-hero-content">
          {poster(media.posterPath, 'w500') ? (
            <img
              className="detail-poster"
              src={poster(media.posterPath, 'w500')!}
              alt={`${media.title} poster`}
            />
          ) : (
            <div className="detail-poster poster-fallback">
              <Film size={44} />
            </div>
          )}
          <div>
            <div className="eyebrow">
              {media.mediaType === 'tv' ? 'TV SERIES' : 'MOVIE'} ·{' '}
              {languageName(media.originalLanguage)} ORIGINAL
            </div>
            <h1>{media.title}</h1>
            {media.originalTitle !== media.title && (
              <p className="original-title">{media.originalTitle}</p>
            )}
            <div className="detail-facts">
              <span>{year(media.releaseDate)}</span>
              {media.runtime !== null && (
                <span>
                  {media.runtime} min{media.tv ? ' / episode' : ''}
                </span>
              )}
              <span>{media.genres.map((g) => g.name).join(' · ')}</span>
            </div>
            <div className="detail-ratings">
              <div>
                <b>IMDb</b>
                <strong>
                  {media.imdbRating !== null ? `${media.imdbRating.toFixed(1)}/10` : 'Unavailable'}
                </strong>
                <small>
                  {media.imdbVotes !== null
                    ? `${media.imdbVotes.toLocaleString()} votes`
                    : media.ratingsState === 'unconfigured'
                      ? 'OMDb not configured'
                      : 'No verified rating'}
                </small>
              </div>
              <div className="tmdb-box">
                <b>TMDB</b>
                <strong>
                  {media.tmdbRating !== null ? `${media.tmdbRating.toFixed(1)}/10` : 'Unrated'}
                </strong>
                <small>{media.tmdbVotes.toLocaleString()} votes</small>
              </div>
            </div>
            <div className="detail-actions">
              <Button
                disabled={busy}
                onClick={() =>
                  void action(
                    () => (saved ? updateEntry(key, { watchStatus: 'Watched' }) : addMedia(media)),
                    saved ? 'Marked watched' : `${media.title} added to your vault`,
                  )
                }
              >
                {saved ? <Check size={18} /> : <Bookmark size={18} />}{' '}
                {saved ? 'Mark watched' : 'Add to watchlist'}
              </Button>
              {saved && (
                <Button variant="outline" onClick={() => setListOpen(true)}>
                  <Plus size={17} />
                  Add to list
                </Button>
              )}
              {saved && (
                <Button
                  variant="outline"
                  aria-label={saved.entry.isFavorite ? 'Unfavorite' : 'Favorite'}
                  onClick={() =>
                    void action(() => updateEntry(key, { isFavorite: !saved.entry.isFavorite }))
                  }
                >
                  <Heart size={18} fill={saved.entry.isFavorite ? 'currentColor' : 'none'} />
                </Button>
              )}
              {media.trailer && (
                <Button asChild variant="ghost">
                  <a href={media.trailer} target="_blank" rel="noreferrer">
                    <Play size={17} />
                    Trailer
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="detail-columns">
        <div>
          <section className="detail-section">
            <h2>The story</h2>
            {media.tagline && <p className="tagline">“{media.tagline}”</p>}
            <p>{media.overview || 'A synopsis is not available from the source.'}</p>
          </section>
          <section className="detail-section">
            <div className="section-title">
              <h2>Where to watch</h2>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void refresh()}>
                <RefreshCw size={14} />
                Refresh availability
              </Button>
            </div>
            <p className="muted">
              Region: {providers?.country || prefs.preferredRegion} ·{' '}
              {providers
                ? `Last checked ${new Date(providers.checkedAt).toLocaleString()}`
                : 'Not checked'}
            </p>
            {providers?.country !== prefs.preferredRegion && (
              <p className="inline-error">
                These saved providers are for another region. Refresh to check{' '}
                {prefs.preferredRegion}.
              </p>
            )}
            {providers && Date.parse(providers.expiresAt) < Date.now() && (
              <p className="inline-error">
                Saved availability may have changed. Refresh when online.
              </p>
            )}
            {providers?.state === 'available' ? (
              Object.entries(providers.groups)
                .filter(([, p]) => p.length)
                .map(([kind, list]) => (
                  <div className="provider-category" key={kind}>
                    <h3>
                      {{
                        flatrate: 'Included with subscription',
                        free: 'Free streaming',
                        ads: 'With advertisements',
                        rent: 'Rent',
                        buy: 'Buy',
                      }[kind] || kind}
                    </h3>
                    <div className="provider-list">
                      {list.map((p) => (
                        <div className="provider-chip" key={p.id}>
                          {poster(p.logoPath, 'w92') && (
                            <img src={poster(p.logoPath, 'w92')!} alt="" />
                          )}
                          <span>{p.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
            ) : (
              <p>
                {providers?.state === 'error'
                  ? 'Availability could not be checked. This does not mean the title is unavailable.'
                  : 'The source has no verified provider information for this region.'}
              </p>
            )}
            {providers?.link && (
              <a href={providers.link} target="_blank" rel="noreferrer" className="text-link">
                View regional viewing options on TMDB <ExternalLink size={14} />
              </a>
            )}
            <p className="attribution">
              Watch availability powered by JustWatch via TMDB. Platform audio and subtitle
              languages have not been verified.
            </p>
          </section>
          {media.cast.length > 0 && (
            <section className="detail-section">
              <h2>The people behind the story</h2>
              <div className="cast-grid">
                {media.cast.slice(0, 12).map((p) => (
                  <div key={p.id}>
                    {poster(p.profilePath || null, 'w185') ? (
                      <img src={poster(p.profilePath || null, 'w185')!} alt="" loading="lazy" />
                    ) : (
                      <div className="cast-placeholder">{p.name.charAt(0)}</div>
                    )}
                    <strong>{p.name}</strong>
                    <small>{p.character}</small>
                  </div>
                ))}
              </div>
              {media.crew.length > 0 && (
                <p className="crew">{media.crew.map((p) => `${p.name} (${p.job})`).join(' · ')}</p>
              )}
            </section>
          )}
          {media.tv && (
            <section className="detail-section">
              <h2>Series details</h2>
              <p>
                {media.tv.seasons} seasons · {media.tv.episodes} episodes · {media.tv.status}
              </p>
              <p className="muted">
                First aired: {media.releaseDate || 'Unknown'} · Last aired:{' '}
                {media.tv.lastAirDate || 'Unknown'} · {media.tv.networks.join(', ')}
              </p>
              <div className="season-list">
                {media.tv.seasonDetails.map((s) => (
                  <div key={s.number}>
                    <strong>{s.name}</strong>
                    <span>
                      {s.episodes} episodes · {s.airDate || 'Date unknown'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
        <aside>
          <section className="detail-section personal-panel">
            <div className="eyebrow">YOUR SIDE OF THE STORY</div>
            <h2>In your vault</h2>
            {saved ? (
              <div className="form-stack">
                <label>
                  Watch status
                  <select
                    value={saved.entry.watchStatus}
                    onChange={(e) =>
                      void action(() =>
                        updateEntry(key, {
                          watchStatus: e.target.value as WatchStatus,
                        }),
                      )
                    }
                  >
                    {statuses.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Personal rating / 10
                  <select
                    value={saved.entry.personalRating ?? ''}
                    onChange={(e) =>
                      void action(() =>
                        updateEntry(key, {
                          personalRating: e.target.value ? Number(e.target.value) : null,
                        }),
                      )
                    }
                  >
                    <option value="">Not rated</option>
                    {Array.from({ length: 21 }, (_, i) => i / 2).map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Watched date
                  <input
                    type="date"
                    value={saved.entry.dateWatched?.slice(0, 10) || ''}
                    onChange={(e) =>
                      void action(() =>
                        updateEntry(key, {
                          dateWatched: e.target.value || null,
                        }),
                      )
                    }
                  />
                </label>
                <label>
                  Your notes
                  <textarea
                    placeholder="What made this story memorable?"
                    maxLength={10000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void action(() => updateEntry(key, { notes }), 'Notes saved on your device')
                  }
                >
                  Save notes
                </Button>
                <div className="rewatch">
                  <span>Rewatches: {saved.entry.rewatchCount}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void action(
                        () =>
                          updateEntry(key, {
                            rewatchCount: saved.entry.rewatchCount + 1,
                            dateWatched: new Date().toISOString().slice(0, 10),
                            watchStatus: 'Watched',
                          }),
                        'Rewatch recorded',
                      )
                    }
                  >
                    + Record rewatch
                  </Button>
                </div>
                <small className="muted">
                  Added {new Date(saved.entry.dateAdded).toLocaleDateString()}
                </small>
                <Button size="sm" variant="ghost" onClick={() => setRemoveOpen(true)}>
                  <Trash2 size={15} />
                  Remove from collection
                </Button>
              </div>
            ) : (
              <>
                <p>Save this title to track it, add notes, and organize your next watch.</p>
                <Button
                  disabled={busy}
                  onClick={() => void action(() => addMedia(media), 'Saved to your vault')}
                >
                  <Plus size={17} />
                  Save this story
                </Button>
              </>
            )}
          </section>
          <section className="detail-section metadata-panel">
            <h3>Original language</h3>
            <p>{languageName(media.originalLanguage)}</p>
            <h3>Spoken languages in metadata</h3>
            <p>{media.spokenLanguages.join(', ') || 'Not provided'}</p>
            <h3>Production countries</h3>
            <p>{media.productionCountries.join(', ') || 'Not provided'}</p>
            <h3>Production companies</h3>
            <p>{media.productionCompanies.join(', ') || 'Not provided'}</p>
            <h3>Release date</h3>
            <p>{media.releaseDate || 'Not provided'}</p>
            <small>Metadata updated {new Date(media.metadataUpdatedAt).toLocaleDateString()}</small>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void refresh()}>
              <RefreshCw size={13} />
              Refresh details
            </Button>
          </section>
        </aside>
      </div>
      {similar.length > 0 && (
        <section>
          <div className="section-title">
            <h2>
              More stories like this<span className="heading-dot">.</span>
            </h2>
          </div>
          <MovieGrid movies={similar} />
        </section>
      )}
      <Dialog open={listOpen} onOpenChange={setListOpen} title="Add to your lists">
        <div className="form-stack">
          {lists?.length ? (
            lists.map((l) => (
              <label className="checkbox-label" key={l.id}>
                <input
                  type="checkbox"
                  checked={membershipOverrides[l.id] ?? !!items?.some((i) => i.listId === l.id)}
                  onChange={(e) => setMembership(l.id, e.target.checked)}
                />
                {l.name}
              </label>
            ))
          ) : (
            <p>
              No custom lists yet. <Link href="/collections">Create your first list.</Link>
            </p>
          )}
          <Button onClick={() => setListOpen(false)}>Done</Button>
        </div>
      </Dialog>
      <Dialog open={removeOpen} onOpenChange={setRemoveOpen} title="Remove this title?">
        <p>
          This removes its notes and list memberships. Export a backup first if you want to keep
          them.
        </p>
        <Button
          variant="destructive"
          onClick={() =>
            void action(async () => {
              await removeMedia(key);
              setRemoveOpen(false);
            }, 'Title removed')
          }
        >
          Remove title
        </Button>
      </Dialog>
    </>
  );
}
