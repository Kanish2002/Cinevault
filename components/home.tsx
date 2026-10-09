"use client";
import Link from "next/link";
import {
  ArrowRight,
  Plus,
  Mic,
  Bookmark,
  Heart,
  Clapperboard,
  Check,
  ShieldCheck,
} from "lucide-react";
import { motion } from "motion/react";
import { useLibrary } from "./providers";
import { MovieGrid } from "./movie-card";
import { Button } from "./ui/button";
import { sortLibrary } from "@/lib/filters";
import { languageName } from "@/lib/utils";
import { DiscoveryFeed } from "./discovery";
export function HomePage() {
  const { rows, loading } = useLibrary();
  const watching = rows.filter((m) => m.entry.watchStatus === "Watching");
  const favorites = rows.filter((m) => m.entry.isFavorite);
  return (
    <>
      <motion.section
        className="welcome"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <div className="eyebrow">
            <span />
            THE NEXT GREAT STORY STARTS HERE
          </div>
          <h1>
            Your cinema.
            <br />
            <em>Beautifully collected.</em>
          </h1>
          <p>
            That movie you heard about. That series you meant to start.
            <br className="desktop-only" /> One search, and it’s yours to
            remember.
          </p>
          <div className="hero-actions">
            <Button
              onClick={() =>
                window.dispatchEvent(new Event("cinevault-search"))
              }
            >
              <Plus size={18} />
              Find a movie
            </Button>
            <Link href="/discover" className="text-link">
              Explore what’s trending <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-features">
            <span>
              <ShieldCheck size={14} />
              Saved on your device
            </span>
            <span>
              <Mic size={14} />
              Say it. Find it. Save it.
            </span>
            <span>🇮🇳 India-first streaming</span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="film-strip">
            <div />
            <div />
            <div />
            <div />
            <div />
          </div>
          <div className="ticket ticket-back">
            <Clapperboard />
            <strong>
              A LITTLE
              <br />
              MOVIE MAGIC.
            </strong>
            <span>ADMIT ONE · YOUR NEXT OBSESSION</span>
          </div>
          <div className="ticket ticket-front">
            <div className="ticket-head">
              <span>CINEVAULT</span>
              <Bookmark size={16} />
            </div>
            <span className="ticket-script">
              A place for
              <br />
              every story.
            </span>
            <div className="ticket-dash" />
            <div className="ticket-bottom">
              <span>PERSONAL COLLECTION</span>
              <span>∞</span>
            </div>
          </div>
          <div className="art-star">✳</div>
        </div>
      </motion.section>
      <div className="vault-metrics">
        {[
          { icon: Clapperboard, value: rows.length, label: "In your vault" },
          {
            icon: Bookmark,
            value: rows.filter((m) => m.entry.watchStatus === "To Watch")
              .length,
            label: "Waiting for you",
          },
          {
            icon: Check,
            value: rows.filter((m) => m.entry.watchStatus === "Watched").length,
            label: "Stories experienced",
          },
          { icon: Heart, value: favorites.length, label: "All-time favorites" },
        ].map((s) => (
          <div key={s.label}>
            <s.icon size={19} />
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
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
              Search a title or tap the microphone. We’ll take care of the
              poster, language, genres, and details.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => window.dispatchEvent(new Event("cinevault-search"))}
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
            <MovieGrid movies={sortLibrary(rows, "added").slice(0, 6)} />
          </section>
          {favorites.length > 0 && (
            <section>
              <SectionTitle
                title="Your favorites"
                sub="The ones that stay with you"
                href="/watchlist?favorite=1"
              />
              <MovieGrid movies={favorites.slice(0, 6)} />
            </section>
          )}
          {Array.from(new Set(rows.map((m) => m.originalLanguage)))
            .sort((a, b) =>
              a === "ta" ? -1 : b === "ta" ? 1 : a.localeCompare(b),
            )
            .slice(0, 4)
            .map((code) => (
              <section key={code}>
                <SectionTitle
                  title={`${languageName(code)} ${rows.filter((m) => m.originalLanguage === code).every((m) => m.mediaType === "movie") ? "movies" : "stories"}`}
                  sub="Automatically collected by original language"
                  href={`/watchlist?language=${code}`}
                />
                <MovieGrid
                  movies={rows
                    .filter((m) => m.originalLanguage === code)
                    .slice(0, 6)}
                />
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
        <DiscoveryFeed kind="trending" limit={6} />
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
export function SectionTitle({
  title,
  sub,
  href,
}: {
  title: string;
  sub?: string;
  href?: string;
}) {
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
