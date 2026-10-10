'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Compass,
  Bookmark,
  CheckCheck,
  Layers3,
  ChartNoAxesCombined,
  Settings,
  Clapperboard,
  Plus,
  ArrowUpRight,
  WifiOff,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { GlobalSearch } from './search';
import { useLibrary } from './providers';
const nav = [
  { url: '/', name: 'Home', icon: Home },
  { url: '/discover', name: 'Discover', icon: Compass },
  { url: '/watchlist', name: 'My Watchlist', icon: Bookmark },
  { url: '/watched', name: 'Watched', icon: CheckCheck },
  { url: '/collections', name: 'Collections', icon: Layers3 },
  { url: '/statistics', name: 'Statistics', icon: ChartNoAxesCombined },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { rows, prefs } = useLibrary();
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Clapperboard size={24} />
          </span>
          Cine<span>Vault</span>
          <span className="brand-dot">.</span>
        </Link>
        <div className="sidebar-label">YOUR CINEMA, CURATED</div>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <Link
              href={n.url}
              key={n.url}
              className={`nav-link ${path === n.url ? 'selected' : ''}`}
              aria-current={path === n.url ? 'page' : undefined}
            >
              <n.icon size={19} />
              {n.name}
              {n.url === '/watchlist' && rows.length > 0 && (
                <span className="nav-count">
                  {rows.filter((m) => m.entry.watchStatus !== 'Watched').length}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <div className="sidebar-label">QUICK CAPTURE</div>
        <Link href="/bulk" className={`nav-link ${path === '/bulk' ? 'selected' : ''}`}>
          <Plus size={19} />
          Bulk Add
        </Link>
        <div className="sidebar-bottom">
          <div className="local-card">
            <span className="local-dot" />
            <strong>Your collection. Your device.</strong>
            <p>No account needed. Made for the movies you don’t want to forget.</p>
            <Link href="/settings">
              Back up your collection <ArrowUpRight size={13} />
            </Link>
          </div>
          <Link href="/settings" className={`nav-link ${path === '/settings' ? 'selected' : ''}`}>
            <Settings size={19} />
            Settings & backup
          </Link>
          <div className="sidebar-profile">
            <div className="avatar">K</div>
            <div>
              <strong>My personal vault</strong>
              <small>
                Local-first · {prefs.preferredRegion === 'IN' ? 'India' : prefs.preferredRegion}
              </small>
            </div>
            <span className="profile-dot" />
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <Link href="/" className="mobile-brand">
            <Clapperboard size={24} />
            <strong>
              CineVault<span>.</span>
            </strong>
          </Link>
          <GlobalSearch />
          <div className="topbar-actions">
            <Link
              href="/bulk"
              className={`mobile-bulk-link ${path === '/bulk' ? 'selected' : ''}`}
              aria-current={path === '/bulk' ? 'page' : undefined}
            >
              <Plus size={16} aria-hidden /> Bulk Add
            </Link>
            <Link className="topbar-settings" href="/settings" aria-label="Settings">
              <Settings size={21} />
            </Link>
          </div>
        </header>
        {offline && (
          <div className="offline-banner" role="status">
            <WifiOff size={16} />
            Offline · Your saved collection and local edits are available.
          </div>
        )}
        <main id="main" className="main-content">
          {children}
        </main>
        <footer className="footer">
          <span>CineVault · Every great story deserves a place.</span>
          <span>
            Movie data:{' '}
            <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer">
              TMDB
            </a>{' '}
            · Availability:{' '}
            <a href="https://www.justwatch.com" target="_blank" rel="noreferrer">
              JustWatch
            </a>
          </span>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.slice(0, 5).map((n) => (
          <Link
            href={n.url}
            key={n.url}
            className={path === n.url ? 'selected' : ''}
            aria-current={path === n.url ? 'page' : undefined}
          >
            <n.icon size={20} />
            <span>{n.name.replace('My ', '')}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
