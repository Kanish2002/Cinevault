'use client';
import Link from 'next/link';
import {
  ArrowRight,
  Plus,
  Mic,
  Bookmark,
  Heart,
  Clapperboard,
  Check,
  ShieldCheck,
  Globe2,
  Layers3,
  ArrowUpRight,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SearchResult } from '@/types';
import { useLibrary } from './providers';
import { MovieGrid } from './movie-card';
import { Button } from './ui/button';
import { sortLibrary } from '@/lib/filters';
import { api, languageName, poster, year } from '@/lib/utils';
import { DiscoveryFeed } from './discovery';
export function HomePage() {
  const { rows, loading } = useLibrary();
  const [spotlight, setSpotlight] = useState<SearchResult[]>([]);
  const [featureIndex, setFeatureIndex] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api<{ results: SearchResult[] }>('/api/discover?kind=trending', { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setSpotlight(data.results);
      })
      .catch(() => {
        /* The discovery feed provides the visible retry state. */
      });
    return () => controller.abort();
  }, []);
  const featured = spotlight[featureIndex];
  const watching = rows.filter((m) => m.entry.watchStatus === 'Watching');
  const favorites = rows.filter((m) => m.entry.isFavorite);
  return (
    <>
      <div className="home-intro">
        <span className="eyebrow">THE PERSONAL CINEMA CLUB</span>
        <Link href="/bulk" className="text-link">
          <Mic size={16} /> Speak or paste a list <ArrowRight size={16} />
        </Link>
      </div>
      <section className="cinema-hero" aria-label="Featured cinema">
        {featured?.backdropPath && (
          <img
            className="cinema-backdrop"
            src={poster(featured.backdropPath, 'w1280')!}
            alt=""
            fetchPriority="high"
          />
        )}
        <div className="cinema-scrim" />
        <div className="cinema-copy">
          <div className="eyebrow">
            <span /> YOUR NEXT GREAT STORY
          </div>
          <h1>
            Your cinema.
            <br />
            <em>Beautifully collected.</em>
          </h1>
          <p className="cinema-description">
            Discover the unforgettable. Keep the ones that stay with you.
            <br className="desktop-only" /> A personal home for every movie and series you love.
          </p>
          <div className="hero-actions">
            <Button onClick={() => window.dispatchEvent(new Event('cinevault-search'))}>
              <Plus size={18} /> Find a movie
            </Button>
            <Link href="/bulk" className="button button-outline">
              <Layers3 size={18} /> Bulk Add
            </Link>
          </div>
          <div className="hero-features">
            <span>
              <ShieldCheck size={15} /> Local-first, always yours
            </span>
            <span>
              <Globe2 size={15} /> India-first streaming
            </span>
          </div>
        </div>
        {featured && (
          <div className="featured-caption">
            <span className="eyebrow">IN THE SPOTLIGHT</span>
            <Link href={`/media/${featured.mediaType}/${featured.tmdbId}`}>
              <h2>
                {featured.title} <ArrowUpRight size={18} />
              </h2>
            </Link>
            <span>
              {year(featured.releaseDate)} · {languageName(featured.originalLanguage)}
              {featured.tmdbRating ? ` · ★ ${featured.tmdbRating.toFixed(1)} TMDB` : ''}
            </span>
            <div className="spotlight-switcher" aria-label="Choose spotlight">
              {spotlight.slice(0, 3).map((m, i) => (
                <button
                  key={m.id}
                  aria-label={`Feature ${m.title}`}
                  aria-pressed={featureIndex === i}
                  onClick={() => setFeatureIndex(i)}
                >
                  <span />
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
      <div className="vault-metrics">
        {[
          {
            icon: Clapperboard,
            value: rows.length,
            label: 'In your vault',
            href: '/watchlist?all=1',
          },
          {
            icon: Bookmark,
            value: rows.filter((m) => m.entry.watchStatus === 'To Watch').length,
            label: 'Watchlist',
            href: '/watchlist',
          },
          {
            icon: Check,
            value: rows.filter((m) => m.entry.watchStatus === 'Watched').length,
            label: 'Watched',
            href: '/watched',
          },
          {
            icon: Heart,
            value: favorites.length,
            label: 'Favorites',
            href: '/watchlist?favorite=1&all=1',
          },
        ].map((s) => (
          <Link key={s.label} href={s.href}>
            <s.icon size={19} />
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </Link>
        ))}
      </div>
      <nav className="discovery-shortcuts" aria-label="Explore cinema">
        {[
          ['trending', 'Trending now'],
          ['top', 'Top rated'],
          ['tv', 'TV series'],
          ['regional', 'Regional gems'],
          ['recommended', 'For you'],
        ].map(([kind, label]) => (
          <Link key={kind} href={`/discover?kind=${kind}`}>
            {label}
            <ArrowUpRight size={14} />
          </Link>
        ))}
      </nav>
      {loading ? (
        <div className="skeleton-row" aria-label="Loading collection" />
      ) : rows.length === 0 ? (
        <section className="first-movie">
          <div className="empty-icon">
            <Bookmark size={28} />
          </div>
          <div>
            <h2>Your story starts with one movie.</h2>
            <p>
              Search a title or tap the microphone. We’ll take care of the poster, language, genres,
              and details.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => window.dispatchEvent(new Event('cinevault-search'))}
          >
            Add your first movie <Plus size={17} />
          </Button>
        </section>
      ) : (
        <>
          {watching.length > 0 && (
            <section>
              <SectionTitle
                title="Continue watching"
                sub="Pick up where you left off"
                href="/watchlist"
              />
              <MovieGrid movies={watching.slice(0, 6)} />
            </section>
          )}
          <section>
            <SectionTitle
              title="Recently added"
              sub="Good stories, safely tucked away"
              href="/watchlist"
            />
            <MovieGrid movies={sortLibrary(rows, 'added').slice(0, 6)} />
          </section>
          {favorites.length > 0 && (
            <section>
              <SectionTitle
                title="Your favorites"
                sub="The ones that stay with you"
                href="/watchlist?favorite=1&all=1"
              />
              <MovieGrid movies={favorites.slice(0, 6)} />
            </section>
          )}
          {Array.from(new Set(rows.map((m) => m.originalLanguage)))
            .sort((a, b) => (a === 'ta' ? -1 : b === 'ta' ? 1 : a.localeCompare(b)))
            .slice(0, 4)
            .map((code) => (
              <section key={code}>
                <SectionTitle
                  title={`${languageName(code)} ${rows.filter((m) => m.originalLanguage === code).every((m) => m.mediaType === 'movie') ? 'movies' : 'stories'}`}
                  sub="Automatically collected by original language"
                  href={`/watchlist?language=${code}`}
                />
                <MovieGrid movies={rows.filter((m) => m.originalLanguage === code).slice(0, 6)} />
              </section>
            ))}
        </>
      )}
      <section>
        <SectionTitle
          title="In the spotlight"
          sub="Trending this week, from TMDB"
          href="/discover"
        />
        {spotlight.length ? (
          <MovieGrid movies={spotlight.slice(0, 6)} />
        ) : (
          <DiscoveryFeed kind="trending" limit={6} />
        )}
      </section>
      <section>
        <SectionTitle
          title="Find your kind of cinema"
          sub="A different way into your next favorite"
          href="/collections"
        />
        <div className="curated-grid">
          {[
            {
              title: 'Beyond the ordinary',
              sub: 'Science fiction & new worlds',
              href: '/discover?kind=genre&genre=878&language=en',
              movie: spotlight[1],
              number: '01',
            },
            {
              title: 'Closer to home',
              sub: 'Explore Tamil cinema',
              href: '/discover?kind=regional&language=ta',
              movie: spotlight[2],
              number: '02',
            },
            {
              title: 'Your own director’s cut',
              sub: 'Make a collection. Set the mood.',
              href: '/collections',
              movie: spotlight[3],
              number: '03',
            },
          ].map((c) => (
            <Link key={c.title} href={c.href} className="curated-card">
              {c.movie?.backdropPath && (
                <img src={poster(c.movie.backdropPath, 'w500')!} alt="" loading="lazy" />
              )}
              <div>
                <span className="curated-number">{c.number} / CINEVAULT SELECTIONS</span>
                <h3>{c.title}</h3>
                <p>{c.sub}</p>
                <ArrowUpRight size={22} />
              </div>
            </Link>
          ))}
        </div>
      </section>
      {rows.length > 0 && (
        <section>
          <SectionTitle
            title="Picked for your taste"
            sub="Based on your favorites, languages, and saved stories"
            href="/discover?kind=recommended"
          />
          <DiscoveryFeed kind="recommended" limit={6} />
        </section>
      )}
    </>
  );
}
export function SectionTitle({ title, sub, href }: { title: string; sub?: string; href?: string }) {
  return (
    <div className="section-title">
      <div>
        <h2>
          {title}
          <span className="heading-dot">.</span>
        </h2>
        {sub && <p>{sub}</p>}
      </div>
      {href && (
        <Link href={href} className="text-link">
          View all <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
