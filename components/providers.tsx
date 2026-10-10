'use client';
import { SyncManager } from './sync-manager';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, library, savePreferences } from '@/lib/db';
import { defaultPrefs, type LibraryMedia, type Preferences } from '@/types';
import { errorMessage } from '@/lib/utils';
type AppContext = {
  rows: LibraryMedia[];
  prefs: Preferences;
  loading: boolean;
  storageError: string;
  toast: (message: string) => void;
};
const Context = createContext<AppContext>({
  rows: [],
  prefs: defaultPrefs,
  loading: true,
  storageError: '',
  toast: () => {},
});
export const useLibrary = () => useContext(Context);
function LocalProvider({ children }: { children: React.ReactNode }) {
  const [storageError, setStorageError] = useState(''),
    [message, setMessage] = useState('');
  const rows = useLiveQuery(() =>
    library().catch((e) => {
      setStorageError(errorMessage(e));
      return [];
    }),
  );
  const prefs = useLiveQuery(() => db.preferences.get('main').catch(() => undefined));
  const toast = useCallback((message: string) => setMessage(message), []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 5500);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    db.open().catch((e) => setStorageError(errorMessage(e)));
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
    }
    const preference = () => {
      savePreferences({}).catch(() => {});
    };
    preference();
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = prefs?.theme || 'dark';
  }, [prefs?.theme]);
  return (
    <Context.Provider
      value={{
        rows: rows || [],
        prefs: prefs || defaultPrefs,
        loading: rows === undefined,
        storageError,
        toast,
      }}
    >
      {storageError && (
        <div role="alert" className="storage-error">
          Browser storage is unavailable: {storageError}. Saved changes cannot be guaranteed. Check
          browser permissions and retry.
        </div>
      )}
      <SyncManager />
      {children}
      {message && (
        <div className="toast" role="status" onClick={() => setMessage('')}>
          {message}
        </div>
      )}
    </Context.Provider>
  );
}
export function Providers({ children }: { children: React.ReactNode }) {
  return <LocalProvider>{children}</LocalProvider>;
}
