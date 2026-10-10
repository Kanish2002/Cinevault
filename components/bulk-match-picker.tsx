'use client';
import { useRef, useState } from 'react';
import { Check, ChevronDown, Film, Search } from 'lucide-react';
import { languageName, poster, year } from '@/lib/utils';
import type { SearchResult } from '@/types';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';

function MatchPoster({ result }: { result?: SearchResult }) {
  const src = result && poster(result.posterPath, 'w92');
  return (
    <span className="match-poster">
      {src ? <img src={src} alt="" loading="lazy" /> : <Film size={22} aria-hidden />}
    </span>
  );
}
function MatchDetails({ result }: { result: SearchResult }) {
  return (
    <span className="match-details">
      <strong>{result.title}</strong>
      {result.originalTitle !== result.title && (
        <span className="match-original">{result.originalTitle}</span>
      )}
      <span className="match-meta">
        <span>{year(result.releaseDate)}</span>
        <span>{languageName(result.originalLanguage)}</span>
        <span className="match-type">{result.mediaType === 'tv' ? 'Series' : 'Movie'}</span>
      </span>
    </span>
  );
}
export function BulkMatchPicker({
  title,
  results,
  selected,
  disabled,
  onSelect,
}: {
  title: string;
  results: SearchResult[];
  selected: string;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const chosen = results.find((result) => result.id === selected);
  const visible = results.filter((result) =>
    `${result.title} ${result.originalTitle} ${year(result.releaseDate)} ${languageName(result.originalLanguage)} ${result.mediaType === 'tv' ? 'Series' : 'Movie'}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`match-trigger ${chosen ? 'has-selection' : ''}`}
        aria-label={`Match for ${title}${chosen ? `: ${chosen.title}, ${year(chosen.releaseDate)}, ${languageName(chosen.originalLanguage)}` : ': Choose a match'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          setQuery('');
          setOpen(true);
        }}
      >
        <MatchPoster result={chosen} />
        {chosen ? (
          <MatchDetails result={chosen} />
        ) : (
          <span className="match-details">
            <strong>Choose the correct title</strong>
            <span className="match-original">
              {results.length} matches · Review year and language
            </span>
          </span>
        )}
        <ChevronDown size={18} aria-hidden />
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`Matches for ${title}`}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          trigger.current?.focus();
        }}
      >
        <p className="match-help">Pick the movie or series you meant. Nothing is saved yet.</p>
        <label className="match-filter">
          <Search size={17} aria-hidden />
          <span className="sr-only">Filter matches</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by title, year, or language…"
          />
        </label>
        <div className="match-options" aria-label={`Candidates for ${title}`}>
          {visible.map((result) => (
            <button
              type="button"
              key={result.id}
              className={`match-option ${selected === result.id ? 'selected' : ''}`}
              aria-pressed={selected === result.id}
              onClick={() => {
                onSelect(result.id);
                setOpen(false);
              }}
            >
              <MatchPoster result={result} />
              <MatchDetails result={result} />
              <span className="match-option-end">
                {result.tmdbRating !== null && <span>TMDB {result.tmdbRating.toFixed(1)}</span>}
                {selected === result.id ? (
                  <Check size={18} aria-label="Selected" />
                ) : (
                  <span className="match-choice-dot" />
                )}
              </span>
            </button>
          ))}
          {!visible.length && (
            <p className="match-help">
              No matches in this list. Try another year or clear the filter.
            </p>
          )}
        </div>
        <div className="match-picker-footer">
          <span>{results.length} matches from TMDB</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={!selected}
            onClick={() => {
              onSelect('');
              setOpen(false);
            }}
          >
            Clear selection
          </Button>
        </div>
      </Dialog>
    </>
  );
}
