# CineVault deployment report

Verified on 9 October 2026.

- Public production application: **https://cinevault-kanish-tech.vercel.app**
- Additional assigned domain: https://cinevault-vert.vercel.app
- Vercel project: `cinevault` (`prj_dhBoO8Kg3Cr4JKEzx9HeHd8S52G7`)
- Repository: https://github.com/Kanish2002/Cinevault
- Production branch: `main`; development branch: `feat/local-first-cinevault`
- Initial implementation commit: `98ffd21f1ee9a8afc0a2f24356a2ec05b44c2266`
- Vercel production build: **READY**, Next.js / Node.js 24 / India `bom1` region.
- Git integration is connected. Pushes to main automatically create production deployments; feature branches create previews.

The preferred `cinevault.vercel.app` domain is assigned to another Vercel team and cannot be attached to this project. Public access is enabled for this personal local-first app; cloud endpoints still require an authenticated owner.

## Verified functionality

An actual HTTPS production browser check returned HTTP 200 and verified the application shell, assets, actionable missing-API configuration, JSON import into an isolated test profile, IndexedDB persistence across reload, watch-status mutation, and a 412 × 915 Android-sized layout. There were no uncaught browser errors or horizontal overflow. The smoke check uses a clearly marked synthetic record solely in its own disposable browser profile; production search does not serve test fixtures.

Locally, 25 Vitest unit/integration tests and 12 Playwright desktop/Android cases passed. Browser workflows cover search/select/save through intercepted API contract fixtures, Tamil/English language grouping, Malayalam/Hindi title disambiguation, duplicates, custom lists, filters, notes, personal ratings, JSON export/merge/fresh-profile recovery, offline edit/reload/reconnect, errors and responsive rendering. Lint, strict TypeScript and the production build passed. GitHub Actions also completed successfully for the initial implementation, including all ten workflow browser cases then present.

Real microphone recognition, live TMDB/OMDb results, and authenticated Neon synchronization have not been verified without their external setup. Database protocol and provider adapters have deterministic tests; that is distinct from live service validation. Runtime log access through the deployment connector returned a scope-related 403, so production validation used the public browser and HTTP endpoints independently.

## Required setup to activate live search

The production `/api/config` reports `tmdb: false`, `omdb: false`, `cloud: false`. This deployment currently supports local collection management and importing an existing backup, but a new user cannot retrieve movies until TMDB is configured.

1. Obtain the **TMDB API Read Access Token** from https://www.themoviedb.org/settings/api under the provider's applicable terms.
2. Open https://vercel.com/kanish-tech/cinevault/settings/environment-variables and add `TMDB_API_READ_ACCESS_TOKEN` for Production. Keep the value out of GitHub and client code.
3. Redeploy the latest main commit from Vercel's Deployments page.
4. Confirm `/api/config` reports `tmdb: true`, then verify real searches for Vikram (2022), Interstel, Drishyam, Money Heist, and an India-specific provider response. The boolean confirms configuration presence, not credential validity.

This one credential enables search, discovery, metadata, posters, language/genre grouping, recommendations and TMDB's regional watch-provider data. No fallback movie array or invented availability is used while it is missing.

## Optional external services

- **IMDb:** configure `OMDB_API_KEY` and redeploy. Unavailable IMDb ratings remain separate from TMDB ratings.
- **Cloud sync:** configure `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GITHUB_CLIENT_ID`, and `GITHUB_CLIENT_SECRET`; apply the reviewed PostgreSQL migration; sign in and enable sync explicitly. See README for the callback URL, ownership model and conflict behavior. Local mode requires none of these.
- **Voice:** browser speech recognition is implemented with text fallback and language selection. Test on an HTTPS Android browser with microphone permission. This is spoken-title capture, not a conversational AI assistant.

## Remaining optional improvements

Cloud-synced preferences, per-episode progress, a dated rewatch journal, stronger typo candidate expansion, shared rate limiting, route-level client bundle splitting and advanced voice conversation remain future work. Browser data can be erased by clearing site data or profile removal; keep JSON backups outside the browser.

The README contains setup, storage design, migrations, tests, deployment maintenance, provider attribution and troubleshooting. Screenshots in `docs/` show the real empty application before API credentials are configured.
