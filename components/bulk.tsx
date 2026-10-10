'use client';
import { useState, useRef, useEffect } from 'react';
import { Check, Search, Plus, RotateCcw, Mic, Square } from 'lucide-react';
import { api, errorMessage } from '@/lib/utils';
import { addMedia, db } from '@/lib/db';
import { useLibrary } from './providers';
import { Button } from './ui/button';
import type { SearchResult, Media } from '@/types';
import { useVoiceInput, spokenMovieTitles } from '@/lib/use-voice-input';
import { BulkMatchPicker } from './bulk-match-picker';
type Row = {
  title: string;
  results: SearchResult[];
  selected: string;
  state: 'pending' | 'searching' | 'review' | 'saved' | 'duplicate' | 'error';
  error?: string;
};
export function BulkPage() {
  const { prefs, toast } = useLibrary();
  const [text, setText] = useState(''),
    [rows, setRows] = useState<Row[]>([]),
    [busy, setBusy] = useState(false);
  const cancel = useRef(false);
  useEffect(
    () => () => {
      cancel.current = true;
    },
    [],
  );
  const voice = useVoiceInput({
    language: prefs.voiceLanguage,
    continuous: true,
    onError: toast,
    onTranscript: (transcript) => {
      const titles = spokenMovieTitles(transcript);
      if (titles.length)
        setText(
          (current) => `${current.trimEnd()}${current.trim() ? '\n' : ''}${titles.join('\n')}`,
        );
    },
  });
  const update = (index: number, patch: Partial<Row>) =>
    setRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  async function match(onlyErrors = false) {
    setBusy(true);
    cancel.current = false;
    const work = onlyErrors
      ? rows
      : text
          .split(/\n/)
          .map((t) => t.trim().replace(/^[-•\d]+[.)]?\s+/, ''))
          .filter(Boolean)
          .filter((v, i, a) => a.indexOf(v) === i)
          .slice(0, 200)
          .map((title) => ({
            title,
            results: [],
            selected: '',
            state: 'pending' as const,
          }));
    if (!onlyErrors) setRows(work);
    for (let i = 0; i < work.length; i++) {
      if (cancel.current) break;
      if (onlyErrors && work[i].state !== 'error') continue;
      update(i, { state: 'searching', error: undefined });
      try {
        const d = await api<{ results: SearchResult[] }>(
          `/api/search?q=${encodeURIComponent(work[i].title)}`,
        );
        if (!d.results.length) {
          update(i, {
            state: 'error',
            error: 'No matches. Edit the title and retry.',
          });
          continue;
        }
        const exact = d.results.filter(
          (r) =>
            r.title.toLowerCase() === work[i].title.toLowerCase() ||
            r.originalTitle.toLowerCase() === work[i].title.toLowerCase(),
        );
        update(i, {
          results: d.results,
          selected: exact.length === 1 ? exact[0].id : '',
          state: 'review',
        });
      } catch (e) {
        update(i, { state: 'error', error: errorMessage(e) });
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    setBusy(false);
  }
  async function save() {
    setBusy(true);
    cancel.current = false;
    let added = 0,
      duplicates = 0;
    for (let i = 0; i < rows.length; i++) {
      if (cancel.current) break;
      const r = rows[i];
      if (r.state !== 'review' || !r.selected) continue;
      const chosen = r.results.find((m) => m.id === r.selected)!;
      try {
        if (await db.entries.get(chosen.id)) {
          update(i, { state: 'duplicate' });
          duplicates++;
          continue;
        }
        const m = await api<Media>(
          `/api/media/${chosen.mediaType}/${chosen.tmdbId}?region=${prefs.preferredRegion}`,
        );
        const result = await addMedia(m);
        update(i, { state: result ? 'saved' : 'duplicate' });
        if (result) added++;
        else duplicates++;
      } catch (e) {
        update(i, { state: 'error', error: errorMessage(e) });
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    setBusy(false);
    toast(`${added} added · ${duplicates} duplicates skipped. Review unresolved titles below.`);
  }
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">TURN “I SHOULD WATCH THAT” INTO A LIST</div>
        <h1>
          A whole list. <em>Paste or speak.</em>
        </h1>
        <p>
          Paste or speak up to 200 titles, one per line. Review the matches, then save the movies
          you meant.
        </p>
      </div>
      <div className="bulk-layout">
        <section className="stat-panel">
          <h2>Your movie list</h2>
          <label className="sr-only" htmlFor="bulk-titles">
            Movie titles
          </label>
          <textarea
            id="bulk-titles"
            className="bulk-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Interstellar\nVikram\nKaithi\nDrishyam\nParasite'}
            disabled={busy}
          />
          <div className="bulk-input-actions">
            <Button disabled={busy || voice.active || !text.trim()} onClick={() => void match()}>
              <Search size={17} />
              Find matches
            </Button>
            <Button
              variant={voice.active ? 'outline' : 'ghost'}
              className={voice.active ? 'bulk-mic active' : 'bulk-mic'}
              disabled={busy || voice.status === 'stopping'}
              aria-label={voice.active ? 'Stop dictating movie titles' : 'Dictate movie titles'}
              aria-pressed={voice.active}
              onClick={() => (voice.active ? voice.stop() : voice.start())}
            >
              {voice.active ? <Square size={15} fill="currentColor" /> : <Mic size={17} />}
              {voice.active ? 'Stop' : 'Speak titles'}
            </Button>
          </div>
          {voice.active ? (
            <div className="bulk-voice-status" role="status">
              <span className="listening-dot" />
              <div>
                <strong>
                  {voice.status === 'starting'
                    ? 'Starting microphone…'
                    : voice.status === 'stopping'
                      ? 'Finishing…'
                      : 'Listening…'}
                </strong>
                <p>
                  {voice.interim || 'Say one title, then pause. Say ‘new line’ to separate titles.'}
                </p>
              </div>
            </div>
          ) : (
            <p className="small muted">
              Speak one title at a time, or say “new line” between titles. You can edit the text
              before matching.
            </p>
          )}
          <p className="muted small">
            Requests are processed one at a time. Ambiguous titles need your selection; existing
            entries keep their status.
          </p>
        </section>
        <section className="stat-panel">
          <div className="section-title">
            <h2>Review & save</h2>
            {busy && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  cancel.current = true;
                }}
              >
                Stop after current title
              </Button>
            )}
          </div>
          {rows.length > 0 && (
            <div className="bulk-summary">
              {rows.filter((r) => r.state === 'saved').length} added ·{' '}
              {rows.filter((r) => r.state === 'duplicate').length} duplicates ·{' '}
              {rows.filter((r) => r.state === 'error').length} errors ·{' '}
              {rows.filter((r) => r.state === 'review' && !r.selected).length} need selection
            </div>
          )}
          {rows.length ? (
            rows.map((r, i) => (
              <div className="bulk-row" key={`${r.title}/${i}`}>
                <div className="bulk-row-heading">
                  <strong>{r.title}</strong>
                  <small>
                    {r.state === 'review'
                      ? r.selected
                        ? 'Likely match — review before saving'
                        : 'Choose the correct movie or series'
                      : r.state}
                  </small>
                </div>
                {r.state === 'review' && (
                  <BulkMatchPicker
                    title={r.title}
                    results={r.results}
                    selected={r.selected}
                    disabled={busy || voice.active}
                    onSelect={(id) => update(i, { selected: id })}
                  />
                )}
                {r.state === 'saved' && <Check size={19} />}{' '}
                {r.state === 'error' && (
                  <>
                    <p role="alert">{r.error}</p>
                    <input
                      aria-label={`Correct ${r.title}`}
                      value={r.title}
                      onChange={(e) => update(i, { title: e.target.value })}
                    />
                  </>
                )}
              </div>
            ))
          ) : (
            <p className="muted">
              Your matches will appear here. Nothing is saved until you review the selection.
            </p>
          )}
          <div className="inline-actions">
            <Button
              disabled={
                busy || voice.active || !rows.some((r) => r.state === 'review' && r.selected)
              }
              onClick={() => void save()}
            >
              <Plus size={17} />
              Save selected matches
            </Button>
            {rows.some((r) => r.state === 'error') && (
              <Button
                variant="outline"
                disabled={busy || voice.active}
                onClick={() => void match(true)}
              >
                <RotateCcw size={15} />
                Retry failed titles
              </Button>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
