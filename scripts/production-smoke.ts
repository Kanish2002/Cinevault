import { chromium } from '@playwright/test';
import { fixture, row } from '../tests/fixtures';
const base = process.env.BASE_URL;
if (!base || new URL(base).protocol !== 'https:')
  throw new Error('Set BASE_URL to the intended HTTPS production origin.');
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
});
try {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    ignoreHTTPSErrors: !!process.env.CODEX_PROXY_CERT,
  });
  const page = await context.newPage(),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const response = await page.goto(base, { timeout: 30000 });
  await page.getByRole('heading', { name: /Your cinema/ }).waitFor();
  const config = (await page.evaluate(async () => await (await fetch('/api/config')).json())) as {
    tmdb: boolean;
    omdb: boolean;
    cloud: boolean;
  };
  const search = page.getByRole('combobox', { name: 'Search movies and TV series' });
  await search.fill('Vikram');
  if (!config.tmdb)
    await page.getByRole('alert').filter({ hasText: 'TMDB API Read Access Token' }).waitFor();
  else await page.getByRole('listbox', { name: 'Movie suggestions' }).waitFor();
  await search.press('Escape');
  const testMedia = {
    ...fixture(999999999, 'en', 'CineVault persistence check'),
    originalTitle: 'CineVault persistence check',
    releaseDate: '',
    overview:
      'Synthetic record used only in an isolated automated test browser profile. This is not provider metadata.',
    genres: [],
    runtime: null,
    tmdbRating: null,
    tmdbVotes: 0,
    imdbId: null,
    imdbRating: null,
    imdbVotes: null,
    ratingsState: 'unconfigured',
    availability: null,
  };
  const entry = {
    ...row(999999999).entry,
    notes: 'Production IndexedDB check',
    dateAdded: new Date().toISOString(),
  };
  const backup = { schemaVersion: 1, media: [testMedia], entries: [entry], lists: [], items: [] };
  await page.goto(base + '/settings');
  await page
    .getByLabel('Import backup file')
    .setInputFiles({
      name: 'test-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    });
  await page.getByRole('button', { name: 'Merge backup', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Imported 1 titles' }).waitFor();
  await page.goto(base + '/watchlist');
  await page.getByRole('heading', { name: 'CineVault persistence check', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'CineVault persistence check', exact: true }).waitFor();
  await page
    .getByRole('button', { name: 'Mark CineVault persistence check Watched', exact: true })
    .click();
  await page.goto(base + '/watched');
  await page.getByRole('heading', { name: 'CineVault persistence check', exact: true }).waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (errors.length || overflow) throw new Error(JSON.stringify({ errors, overflow }));
  console.log(
    JSON.stringify({
      url: base,
      status: response?.status(),
      config,
      pageErrors: errors,
      mobileOverflow: overflow,
      verified: [
        'public shell',
        'static assets',
        'honest search configuration',
        'backup import',
        'IndexedDB add/reload persistence',
        'watch status mutation',
        'mobile layout',
      ],
      liveProviderChecks: config.tmdb
        ? 'credentials configured; manual live metadata verification still required'
        : 'blocked by missing TMDB token',
    }),
  );
  await context.close();
} finally {
  await browser.close();
}
