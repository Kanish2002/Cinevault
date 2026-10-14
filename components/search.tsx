'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, Mic, Square, LoaderCircle, Plus, Check, ArrowUpRight, X } from 'lucide-react';
import { api, errorMessage, languageName, poster, year } from '@/lib/utils';
import { addMedia, db } from '@/lib/db';
import { useLibrary } from './providers';
import { Button } from './ui/button';
import type { SearchResult, Media } from '@/types';
import { useVoiceInput } from '@/lib/use-voice-input';
export function GlobalSearch() {
  const searchParams = useSearchParams();
  const path = usePathname();
  const { prefs, rows, toast } = useLibrary();
  const [query, setQuery] = useState(''),
    [results, setResults] = useState<SearchResult[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(0),
    [adding, setAdding] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null);
  const voice = useVoiceInput({
    language: prefs.voiceLanguage,
    onError: toast,
    onTranscript: (transcript) => {
      const text = transcript
        .replace(/^(?:add|save|search(?: for)?|find)\s+/i, '')
        .replace(/\s+(?:to (?:my )?(?:watchlist|collection))\.?$/i, '');
      setQuery(text);
      setOpen(true);
    },
  });
  useEffect(() => {
    setOpen(false);
    voice.cancel();
  }, [path, voice.cancel]);
  const saved = new Set(rows.map((m) => m.id));
  useEffect(() => {
    if (searchParams.get('capture')) {
      setQuery(searchParams.get('q') || '');
      setOpen(true);
      input.current?.focus();
    }
  }, [searchParams]);
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setError('');
      setBusy(false);
      return;
    }
    setResults([]);
    setActive(0);
    setBusy(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (!navigator.onLine) {
        setBusy(false);
        setError(
          'You are offline. Your saved collection is available; online search will resume when connected.',
        );
        return;
      }
      setBusy(true);
      setError('');
      try {
        const d = await api<{ results: SearchResult[] }>(
          `/api/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        setResults(d.results);
        setActive(0);
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(errorMessage(e));
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  useEffect(() => {
    const outside = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    return () => {
      document.removeEventListener('mousedown', outside);
    };
  }, []);
  useEffect(() => {
    const listener = () => {
      input.current?.focus();
      setOpen(true);
    };
    window.addEventListener('cinevault-search', listener);
    return () => window.removeEventListener('cinevault-search', listener);
  }, []);
  async function quickAdd(result: SearchResult) {
    setAdding(result.id);
    try {
      if (await db.entries.get(result.id)) {
        toast('Already saved. Your existing status is preserved.');
        return;
      }
      const cached = await db.media.get(result.id);
      const media =
        cached && Date.parse(cached.metadataUpdatedAt) > Date.now() - 86400000
          ? cached
          : await api<Media>(
              `/api/media/${result.mediaType}/${result.tmdbId}?region=${prefs.preferredRegion}`,
            );
      const added = await addMedia(media);
      toast(
        added
          ? `${media.title} added to ${prefs.defaultWatchStatus} · ${languageName(media.originalLanguage)}`
          : 'Already in your collection.',
      );
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setAdding(null);
    }
  }
  return (
    <div ref={ref} className="global-search">
      <div className="search-field">
        <Search size={20} aria-hidden />
        <input
          id="global-search"
          ref={input}
          role="combobox"
          aria-label="Search movies and TV series"
          aria-autocomplete="list"
          aria-expanded={open && !!query}
          aria-controls="movie-suggestions"
          aria-activedescendant={results.length && open ? `suggestion-${active}` : undefined}
          placeholder="Find a movie, series, or your next obsession…"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'ArrowDown' && results.length) {
              e.preventDefault();
              setActive((i) => Math.min(results.length - 1, i + 1));
            }
            if (e.key === 'ArrowUp' && results.length) {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            }
            if (
              e.key === 'Enter' &&
              open &&
              !busy &&
              !voice.active &&
              !adding &&
              results[active] &&
              !saved.has(results[active].id)
            ) {
              e.preventDefault();
              void quickAdd(results[active]);
            }
          }}
        />
        {query && (
          <button
            aria-label="Clear search"
            onClick={() => {
              setQuery('');
              input.current?.focus();
            }}
          >
            <X size={16} />
          </button>
        )}
        <button
          className={voice.active ? 'voice-button listening' : 'voice-button'}
          aria-label={voice.active ? 'Stop voice search' : 'Start voice search'}
          aria-pressed={voice.active}
          disabled={voice.status === 'stopping'}
          onClick={() => (voice.active ? voice.stop() : voice.start())}
        >
          {voice.active ? <Square size={17} fill="currentColor" /> : <Mic size={19} />}
        </button>
        <span className="search-shortcut">↵</span>
      </div>
      {voice.active && (
        <div className="voice-caption">
          <div role="status">
            <strong>
              {voice.status === 'starting'
                ? 'Starting microphone…'
                : voice.status === 'stopping'
                  ? 'Finishing…'
                  : 'Listening…'}
            </strong>
            <span>{voice.interim || 'Say a movie title. Review the matches before saving.'}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={voice.status === 'stopping'}
            onClick={voice.stop}
          >
            <Square size={12} fill="currentColor" /> Stop
          </Button>
        </div>
      )}
      {open && query.trim() && !voice.active && (
        <div className="search-results">
          <div className="search-label">
            <span>FIND YOUR NEXT STORY</span>
            {busy && <LoaderCircle className="spin" size={16} />}
          </div>
          {error && (
            <div role="alert" className="search-message">
              {error}
              <Button variant="outline" size="sm" onClick={() => setQuery((q) => q + ' ')}>
                Retry
              </Button>
            </div>
          )}
          {!busy && !error && !results.length && (
            <p className="search-message">
              No titles found. Try a shorter title, original title, or add the release year.
            </p>
          )}
          <ul id="movie-suggestions" role="listbox" aria-label="Movie suggestions">
            {results.map((r, i) => (
              <li
                id={`suggestion-${i}`}
                role="option"
                aria-selected={active === i}
                key={r.id}
                className={active === i ? 'search-result active' : 'search-result'}
                onMouseEnter={() => setActive(i)}
              >
                <Link
                  href={`/media/${r.mediaType}/${r.tmdbId}`}
                  onClick={() => setOpen(false)}
                  className="result-main"
                >
                  {poster(r.posterPath) ? (
                    <img src={poster(r.posterPath, 'w92')!} alt="" />
                  ) : (
                    <div className="poster-mini">CV</div>
                  )}
                  <div>
                    <strong>{r.title}</strong>
                    <small>
                      {year(r.releaseDate)} · {languageName(r.originalLanguage)} ·{' '}
                      {r.mediaType === 'tv' ? 'Series' : 'Movie'}
                    </small>
                    {r.originalTitle !== r.title && <small>{r.originalTitle}</small>}
                  </div>
                </Link>
                <div className="result-actions">
                  {r.tmdbRating !== null && (
                    <span className="rating-small">TMDB {r.tmdbRating.toFixed(1)}</span>
                  )}
                  <Button
                    variant={saved.has(r.id) ? 'ghost' : 'default'}
                    size="icon"
                    aria-label={
                      saved.has(r.id)
                        ? `${r.title} already saved`
                        : `Add ${r.title} (${year(r.releaseDate)})`
                    }
                    disabled={adding === r.id || saved.has(r.id)}
                    onClick={() => void quickAdd(r)}
                  >
                    {adding === r.id ? (
                      <LoaderCircle className="spin" size={18} />
                    ) : saved.has(r.id) ? (
                      <Check size={18} />
                    ) : (
                      <Plus size={18} />
                    )}
                  </Button>
                  <Link
                    href={`/media/${r.mediaType}/${r.tmdbId}`}
                    aria-label={`View ${r.title}`}
                    onClick={() => setOpen(false)}
                  >
                    <ArrowUpRight size={18} />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          <div className="search-foot">↑ ↓ to browse · Enter to add · Metadata from TMDB</div>
        </div>
      )}
    </div>
  );
}
