# CineVault project memory

Before changing UI, read `design-system/cinevault/MASTER.md`. It records the user's Stitch reference, approved visual direction, navigation and mobile voice lifecycle contracts. Keep it up to date when decisions change.

CineVault is an existing Next.js application deployed from this repository to Vercel. Preserve its local IndexedDB data, portable backups and optional per-account Neon synchronization. Never replace real movie metadata or collection totals with demo data.

Install with `npm ci --legacy-peer-deps` (the existing auth dependency tree requires this flag). Validate with `npm run typecheck`, `npm test`, `npm run build` and the relevant existing Playwright flows. Run the full CI checks before a production update. Recognition mocks verify lifecycle logic, not actual microphone hardware/service quality.
