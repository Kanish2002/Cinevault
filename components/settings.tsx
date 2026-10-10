'use client';
import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { authClient } from '@/lib/auth/client';
import { accountOwner } from '@/lib/sync/identity';
import { AccountForm } from './account-form';
import {
  Download,
  Upload,
  ShieldCheck,
  HardDrive,
  Cloud,
  Mic,
  Check,
  RefreshCw,
} from 'lucide-react';
import { db, savePreferences } from '@/lib/db';
import { statuses, type Preferences } from '@/types';
import { useLibrary } from './providers';
import {
  makeBackup,
  toCSV,
  validateBackup,
  parseCSV,
  importBackup,
  download,
  type Backup,
} from '@/lib/import-export';
import { queueExisting, runSync, resolveConflict, assertVaultOwner } from '@/lib/sync/client';
import { api, errorMessage } from '@/lib/utils';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
export function SettingsPage() {
  const { prefs, toast, rows } = useLibrary();
  const { data: session } = authClient.useSession();
  const [config, setConfig] = useState<{
      tmdb: boolean;
      omdb: boolean;
      cloud: boolean;
    } | null>(null),
    [estimate, setEstimate] = useState<StorageEstimate | null>(null),
    [persistent, setPersistent] = useState<boolean | null>(null),
    [backup, setBackup] = useState<Backup | null>(null),
    [errors, setErrors] = useState<string[]>([]),
    [replace, setReplace] = useState(false),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [syncStatus, setSyncStatus] = useState('Not connected');
  const file = useRef<HTMLInputElement>(null);
  const conflicts = useLiveQuery(() => db.state.where('id').startsWith('conflict/').toArray(), []);
  const patch = (p: Partial<Preferences>) =>
    void savePreferences(p).catch((e) => toast(errorMessage(e)));
  useEffect(() => {
    api<typeof config>('/api/config')
      .then(setConfig)
      .catch(() => {});
    navigator.storage?.estimate?.().then(setEstimate);
    navigator.storage?.persisted?.().then(setPersistent);
  }, []);
  const [languagesInput, setLanguagesInput] = useState(prefs.languagePreferences.join(', '));
  useEffect(
    () => setLanguagesInput(prefs.languagePreferences.join(', ')),
    [prefs.languagePreferences],
  );
  const owner = accountOwner(session?.user?.id);
  const [syncChoice, setSyncChoice] = useState<boolean | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  useEffect(() => {
    if (syncChoice === prefs.syncEnabled) setSyncChoice(null);
  }, [prefs.syncEnabled, syncChoice]);
  const binding = useLiveQuery(() => db.state.get('sync-owner'), []);
  const wrongAccount = !!owner && !!binding && binding.value !== owner;

  async function exportFile(format: 'json' | 'csv') {
    setBusy(true);
    try {
      const b = await makeBackup(),
        content = format === 'json' ? JSON.stringify(b, null, 2) : toCSV(b);
      download(
        content,
        `cinevault-${new Date().toISOString().slice(0, 10)}.${format}`,
        format === 'json' ? 'application/json' : 'text/csv;charset=utf-8',
      );
      await savePreferences({ lastBackupAt: new Date().toISOString() });
      toast('Backup generated. Keep the downloaded file somewhere safe.');
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function readFile(f: File) {
    if (f.size > 50000000) {
      toast('Please choose a backup smaller than 50 MB.');
      return;
    }
    try {
      const text = await f.text(),
        result = f.name.toLowerCase().endsWith('.csv')
          ? parseCSV(text)
          : validateBackup(JSON.parse(text));
      if (!result.data.entries.length && !result.data.lists.length)
        throw new Error('No valid saved entries or lists were found.');
      setBackup(result.data);
      setErrors(result.errors);
      setReplace(false);
    } catch (e) {
      toast(`Cannot import: ${errorMessage(e)}`);
    }
  }
  async function restore() {
    if (!backup) return;
    setBusy(true);
    try {
      const r = await importBackup(backup, replace ? 'replace' : 'merge');
      toast(
        `Imported ${r.added} titles · ${r.duplicates} duplicates preserved · ${errors.length} invalid records skipped`,
      );
      setBackup(null);
      setConfirm(false);
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">MAKE YOUR VAULT FEEL LIKE YOU</div>
        <h1>
          Your vault. <em>Your way.</em>
        </h1>
        <p>Preferences, portable backups, and optional cloud synchronization.</p>
      </div>
      <div className="settings-grid">
        <section className="stat-panel">
          <h2>Preferences</h2>
          <div className="form-stack">
            <label>
              Default watch status
              <select
                value={prefs.defaultWatchStatus}
                onChange={(e) =>
                  patch({
                    defaultWatchStatus: e.target.value as Preferences['defaultWatchStatus'],
                  })
                }
              >
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Streaming region
              <select
                value={prefs.preferredRegion}
                onChange={(e) => patch({ preferredRegion: e.target.value })}
              >
                {[
                  ['IN', 'India'],
                  ['US', 'United States'],
                  ['GB', 'United Kingdom'],
                  ['CA', 'Canada'],
                  ['AU', 'Australia'],
                  ['DE', 'Germany'],
                  ['FR', 'France'],
                  ['JP', 'Japan'],
                  ['KR', 'South Korea'],
                  ['SG', 'Singapore'],
                  ['AE', 'United Arab Emirates'],
                ].map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Theme
              <select
                value={prefs.theme}
                onChange={(e) => patch({ theme: e.target.value as Preferences['theme'] })}
              >
                <option value="dark">Midnight cinema</option>
                <option value="light">Matinée light</option>
              </select>
            </label>
            <label>
              <Mic size={15} />
              Voice recognition language
              <select
                value={prefs.voiceLanguage}
                onChange={(e) => patch({ voiceLanguage: e.target.value })}
              >
                {[
                  ['en-IN', 'English (India)'],
                  ['ta-IN', 'Tamil'],
                  ['hi-IN', 'Hindi'],
                  ['te-IN', 'Telugu'],
                  ['ml-IN', 'Malayalam'],
                  ['kn-IN', 'Kannada'],
                  ['en-US', 'English (US)'],
                ].map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Recommendation languages
              <input
                placeholder="ta, en, ml"
                value={languagesInput}
                onChange={(e) => setLanguagesInput(e.target.value)}
                onBlur={() =>
                  patch({
                    languagePreferences: languagesInput
                      .split(',')
                      .map((s) => s.trim())
                      .filter((s) => /^[a-z]{2,3}$/.test(s)),
                  })
                }
              />
            </label>
          </div>
        </section>
        <section className="stat-panel">
          <h2>
            <Download size={21} />
            Backup & restore
          </h2>
          <p>Your collection lives in this browser profile. A backup makes it portable.</p>
          <div className="inline-actions">
            <Button disabled={busy} onClick={() => void exportFile('json')}>
              <Download size={17} />
              Export JSON
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void exportFile('csv')}>
              Export CSV
            </Button>
          </div>
          <p className="muted small">
            JSON preserves titles, statuses, notes, ratings, custom lists, relationships, and
            preferences. CSV preserves title records and annotations; list relationships require
            JSON.
          </p>
          <div className="settings-divider" />
          <Button variant="outline" onClick={() => file.current?.click()}>
            <Upload size={17} />
            Import backup
          </Button>
          <input
            ref={file}
            aria-label="Import backup file"
            type="file"
            accept=".json,.csv,application/json,text/csv"
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.[0]) void readFile(e.target.files[0]);
              e.target.value = '';
            }}
          />
          <p className="muted small">
            Last backup generated:{' '}
            {prefs.lastBackupAt ? new Date(prefs.lastBackupAt).toLocaleString() : 'Never'}
          </p>
          {rows.length > 0 &&
            (!prefs.lastBackupAt ||
              Date.parse(prefs.lastBackupAt) < Date.now() - 30 * 86400000) && (
              <p className="backup-reminder">
                A good time to save a backup. Keep a copy outside this browser.
              </p>
            )}
        </section>
        <section className="stat-panel">
          <h2>
            <HardDrive size={21} />
            Local storage
          </h2>
          <p>
            {persistent === true
              ? 'Persistent storage is granted for this browser.'
              : persistent === false
                ? 'Storage works locally; persistence permission is not granted.'
                : 'Browser persistence status is unavailable.'}
          </p>
          <p className="muted">
            {estimate
              ? `${((estimate.usage || 0) / 1048576).toFixed(2)} MB used · ${((estimate.quota || 0) / 1073741824).toFixed(1)} GB browser quota`
              : 'Storage estimates are not supported by this browser.'}
          </p>
          <Button
            variant="outline"
            onClick={async () => {
              const granted = await navigator.storage?.persist?.();
              setPersistent(granted ?? null);
              toast(
                granted
                  ? 'Persistent storage granted. Backups are still recommended.'
                  : 'Your browser did not grant persistence. Local saving still works.',
              );
            }}
          >
            <ShieldCheck size={17} />
            Request storage persistence
          </Button>
          <p className="small muted">
            Clearing site data, removing a browser profile, or uninstalling the app may erase local
            data. Device restarts normally preserve it. Private browsing may be temporary.
          </p>
        </section>
        <section className="stat-panel">
          <h2>
            <Cloud size={21} />
            Optional cloud sync
          </h2>
          <p>
            {config?.cloud
              ? 'Create an account or sign in with your email and CineVault password, then enable sync to keep your movies, lists, notes, ratings, and preferences together on every device.'
              : 'Local mode is active. Account sync needs Neon authentication configuration.'}
          </p>
          {config?.cloud ? (
            owner ? (
              <>
                <p>Signed in as {session?.user?.email || session?.user?.name}</p>
                {wrongAccount && (
                  <p role="alert">
                    This local vault belongs to another account. Use a separate browser profile for
                    this account. Export a backup before moving an older vault.
                  </p>
                )}
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={syncChoice ?? prefs.syncEnabled}
                    disabled={wrongAccount || syncBusy}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setSyncChoice(enabled);
                      setSyncBusy(true);
                      void (
                        enabled && owner
                          ? assertVaultOwner(owner).then(queueExisting)
                          : Promise.resolve()
                      )
                        .then(() => savePreferences({ syncEnabled: enabled }))
                        .catch((e) => {
                          setSyncChoice(null);
                          toast(errorMessage(e));
                        })
                        .finally(() => setSyncBusy(false));
                    }}
                  />
                  Enable sync for this local vault
                </label>
                <p role="status" className="muted">
                  {syncStatus}
                </p>
                <div className="inline-actions">
                  <Button
                    variant="outline"
                    disabled={!owner || wrongAccount}
                    onClick={() => {
                      if (owner)
                        void runSync(owner)
                          .then((r) => {
                            setSyncStatus(r.conflicts ? 'Conflicts need review' : 'Up to date');
                            toast('Sync completed');
                          })
                          .catch((e) => toast(errorMessage(e)));
                    }}
                  >
                    <RefreshCw size={15} />
                    Sync now
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      void savePreferences({ syncEnabled: false })
                        .then(() =>
                          authClient.signOut().then((result) => {
                            if (result.error) throw new Error(result.error.message);
                          }),
                        )
                        .catch((e) => toast(errorMessage(e)));
                    }}
                  >
                    Sign out
                  </Button>
                </div>
              </>
            ) : (
              <AccountForm />
            )
          ) : (
            <p className="small muted">
              Account sync is not available yet. Your saved collection remains on this device.
            </p>
          )}
          {conflicts?.map((c) => (
            <div className="conflict" key={c.id}>
              <strong>Conflict: {c.id.replace('conflict/', '')}</strong>
              <p>Both devices changed this record. Choose which version to keep.</p>
              <Button
                size="sm"
                onClick={() =>
                  void resolveConflict(c.id.replace('conflict/', ''), 'local').then(() =>
                    toast('Local version queued for sync'),
                  )
                }
              >
                Keep this device
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void resolveConflict(c.id.replace('conflict/', ''), 'cloud').then(() =>
                    toast('Cloud version restored'),
                  )
                }
              >
                Use cloud version
              </Button>
            </div>
          ))}
        </section>
        <section className="stat-panel">
          <h2>Connected movie services</h2>
          <div className="service-status">
            <span>TMDB · Search, details & availability</span>
            <b>
              {config?.tmdb ? (
                <>
                  <Check size={14} />
                  Configured
                </>
              ) : (
                'Needs API token'
              )}
            </b>
          </div>
          <div className="service-status">
            <span>OMDb · IMDb ratings</span>
            <b>
              {config?.omdb ? (
                <>
                  <Check size={14} />
                  Configured
                </>
              ) : (
                'Optional · not configured'
              )}
            </b>
          </div>
          <p className="muted small">
            Tokens are used only on the server. Configuration status does not guarantee that a
            provider credential is valid.
          </p>
          <p className="attribution">
            This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming
            availability powered by JustWatch. IMDb ratings sourced through OMDb when configured.
          </p>
          <a
            className="text-link"
            href="https://www.themoviedb.org/settings/api"
            target="_blank"
            rel="noreferrer"
          >
            TMDB API settings ↗
          </a>
        </section>
        <section className="stat-panel">
          <h2>On your home screen</h2>
          <p>
            In Chrome on Android, open the browser menu and choose “Install app” or “Add to Home
            screen”.
          </p>
          <p className="muted small">
            The installed app opens quickly. Voice recognition depends on browser support and may
            use your browser’s speech service. CineVault does not store voice recordings. Saved
            titles and local editing work offline after the app has been cached.
          </p>
        </section>
      </div>
      <Dialog
        open={!!backup && !confirm}
        onOpenChange={(o) => {
          if (!o) setBackup(null);
        }}
        title="Review your backup"
      >
        <p>
          {backup?.entries.length} valid titles · {backup?.lists.length} lists ·{' '}
          {backup?.items.length} list relationships
        </p>
        {errors.length > 0 && (
          <div className="import-errors">
            <p>{errors.length} invalid records will be skipped:</p>
            <ul>
              {errors.slice(0, 20).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="form-stack">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
            />
            Replace this collection instead of merging
          </label>
          <p className="muted">
            Merge preserves existing annotations and skips duplicate titles. Replace removes current
            titles and lists first.
          </p>
          <Button disabled={busy} onClick={() => (replace ? setConfirm(true) : void restore())}>
            {replace ? 'Continue to replacement confirmation' : 'Merge backup'}
          </Button>
        </div>
      </Dialog>
      <Dialog open={confirm} onOpenChange={setConfirm} title="Replace your entire collection?">
        <p>
          Current titles, notes, and lists will be replaced with this backup. Export your current
          collection first if you want to retain it.
        </p>
        <Button variant="destructive" disabled={busy} onClick={() => void restore()}>
          Replace collection now
        </Button>
      </Dialog>
    </>
  );
}
