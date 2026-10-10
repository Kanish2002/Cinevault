'use client';
import { useEffect } from 'react';
import { authClient } from '@/lib/auth/client';
import { accountOwner } from '@/lib/sync/identity';
import { useLibrary } from './providers';
import { runSync } from '@/lib/sync/client';
export function SyncManager() {
  const { prefs, toast } = useLibrary();
  const { data: session } = authClient.useSession();
  const owner = accountOwner(session?.user?.id);
  useEffect(() => {
    if (!prefs.syncEnabled || !owner) return;
    let running = false,
      cancelled = false;
    const sync = async () => {
      if (running || cancelled || !navigator.onLine) return;
      running = true;
      try {
        const r = await runSync(owner);
        if (r.conflicts) toast('Cloud sync has conflicting changes. Review them in Settings.');
      } catch (e) {
        if (!cancelled)
          toast(e instanceof Error ? e.message : 'Sync failed; your local changes are safe.');
      } finally {
        running = false;
      }
    };
    void sync();
    const timer = setInterval(() => void sync(), 30000);
    window.addEventListener('online', sync);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('online', sync);
    };
  }, [prefs.syncEnabled, owner, toast]);
  return null;
}
