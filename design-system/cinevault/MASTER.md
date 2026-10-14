# CineVault design memory

## Direction and references

Reference: https://stitch.withgoogle.com/projects/4945912962951529765, Obsidian Cinema and redesigned home/desktop variants. User requested a cohesive redesign and a mobile bulk-dictation repair.

Design guidance: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill at commit recorded below. Read its SKILL.md, generated a cinema discovery design recommendation, and applied its accessibility, touch, responsive and form guidance. The generic funnel recommendation was unsuitable for a personal library, so the real application workflow and user's Stitch reference take precedence.

## Visual language

- Obsidian background #0a0b0e, panel #121419, raised panel #1b1e25.
- Warm amber #f5b544 for actions and selected states; ivory #f3f0e9 for primary text, #a2a7b2 for secondary text.
- Maintain a complete light theme with accessible brown actions. A cinematic photograph can stay dark in either theme, with its own explicit light text and scrim.
- Editorial serif headings paired with a clean system sans. Use local font fallbacks rather than depending on a remote font request.
- Rounded 10–20px surfaces, consistent 4/8px spacing, restrained borders and subtle feedback. Poster art supplies visual richness.
- Hero uses live TMDB images and metadata. No invented ratings, counts, release dates, testimonials, sync state or integrations.

## Navigation and tasks

- Desktop: persistent navigation, global search, Bulk Add and Settings.
- Mobile: Home, Discover, Watchlist, Watched, More; More exposes Collections, Statistics, Bulk Add and Settings. Bulk Add also remains visible in the header.
- Home metrics link to actual filtered libraries, including the entire vault and favorites across watched statuses.
- Discovery shortcuts pass explicit category, language and genre parameters. Mounted views respond to subsequent URL changes.
- Bulk Add: paste/speak → review poster, year, language and media type → save. Show progress, counts, persistent voice errors and an inline recognition-language selector.
- Never silently truncate a batch. Reject >200 nonempty lines with a useful message and keep input intact. Editing source input invalidates old review results.

## Voice lifecycle contract

- Recognition is feature-detected. Unsupported, denied, unavailable and startup-timeout paths retain text input.
- One microphone owner at a time. Session switching, page changes, backgrounding and unmount abort capture and clear pending restarts.
- Final result indices are delivered once per recognition instance, even when Android replays earlier results. Interim speech is preview-only.
- Continuous bulk dictation can recover from natural end/silence; stop after three consecutive empty sessions. Permission and other errors never auto-retry.
- Stop cancels desired listening and pending restart, requests a final result, and has a bounded fallback. No background auto-resume.
- Do not claim simulated recognition tests prove physical-device microphone or service behavior. Validate on a real Android/iOS device before asserting that.

## Quality gates

- Touch targets ≥44px, readable form inputs ≥16px to avoid iOS focus zoom, labelled controls, visible focus, keyboard-capable dialogs and honest loading/error states.
- Small screens 320/360/390px, tablet and desktop must have no document overflow. Respect dynamic viewport height, safe areas and reduced motion.
- Unit tests cover speech replay, restart cancellation, permissions, empty-end limits, session ownership and background cancellation.
- End-to-end tests cover movie search/save, lists, filters, backup/restore, offline edits, bulk match selection, mobile navigation and URL-driven filters.
- Preserve IndexedDB collection data, account boundaries, optional Neon sync and portable backups.

Guidance revision: `616663179c5f9b5e2b3e07cab23ac9cad76378f3`.
