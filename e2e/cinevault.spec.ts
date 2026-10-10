import { test, expect, type Page } from '@playwright/test';
import { fixture, result } from '../tests/fixtures';
async function mockMovies(page: Page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/auth/')) return route.fulfill({ json: {} });
    if (url.pathname === '/api/config')
      return route.fulfill({ json: { tmdb: true, omdb: false, cloud: false } });
    if (url.pathname === '/api/search') {
      const q = url.searchParams.get('q') || '';
      const results = q.startsWith('Drishyam')
        ? [
            { ...result(1, 'ml', 'Drishyam'), releaseDate: '2013-12-19' },
            { ...result(2, 'hi', 'Drishyam'), releaseDate: '2015-07-31' },
          ]
        : q.startsWith('Interstel')
          ? [result(157336, 'en', 'Interstellar')]
          : [result()];
      return route.fulfill({ json: { results } });
    }
    if (url.pathname.startsWith('/api/media/')) {
      const id = Number(url.pathname.split('/')[4]);
      return route.fulfill({
        json: id === 157336 ? fixture(id, 'en', 'Interstellar') : fixture(id),
      });
    }
    if (['/api/discover', '/api/recommendations'].includes(url.pathname))
      return route.fulfill({ json: { results: [], totalPages: 1 } });
    return route.continue();
  });
}
async function addVikram(page: Page) {
  await page.getByRole('combobox', { name: 'Search movies and TV series' }).fill('Vikram');
  await page.getByRole('button', { name: 'Add Vikram (2022)' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Vikram added' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Search movies and TV series' }).press('Escape');
}

test('core story: quick add, language grouping, persistence, notes, lists, filters, backup and merge', async ({
  page,
}) => {
  await mockMovies(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Your cinema/ })).toBeVisible();
  await addVikram(page);
  await page.reload();
  await page.goto('/watchlist');
  await expect(page.getByRole('heading', { name: 'Vikram', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'View Vikram', exact: true }).click();
  await expect(page.getByText('Tamil ORIGINAL', { exact: false })).toBeVisible();
  await page.getByRole('combobox', { name: 'Watch status', exact: true }).selectOption('Watched');
  await page.getByRole('combobox', { name: 'Personal rating / 10', exact: true }).selectOption('9');
  await page.getByLabel('Your notes').fill('Memorable Tamil thriller');
  await page.getByRole('button', { name: 'Save notes', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Notes saved' })).toBeVisible();
  await page.goto('/collections');
  await page.getByRole('button', { name: 'New list', exact: true }).click();
  await page.getByLabel('List name').fill('Weekend Movies');
  await page.getByRole('button', { name: 'Create list', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Weekend Movies', exact: true })).toBeVisible();
  await page.goto('/media/movie/911');
  await page.getByRole('button', { name: 'Add to list', exact: true }).click();
  await page.getByLabel('Weekend Movies', { exact: true }).check();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.goto('/watched');
  await page.getByRole('button', { name: /Filters/ }).click();
  await page.getByRole('combobox', { name: 'Original language', exact: true }).selectOption('ta');
  await page.getByRole('combobox', { name: 'Genre', exact: true }).selectOption('Thriller');
  await page.getByRole('button', { name: 'Show 1 stories' }).click();
  await expect(page.getByRole('heading', { name: 'Vikram', exact: true })).toBeVisible();
  await page.goto('/settings');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const downloaded = await downloadPromise;
  const path = await downloaded.path();
  expect(path).toBeTruthy();
  await page.getByLabel('Import backup file').setInputFiles(path!);
  await expect(page.getByText('1 valid titles · 1 lists · 1 list relationships')).toBeVisible();
  await page.getByRole('button', { name: 'Merge backup', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: '1 duplicates preserved' }),
  ).toBeVisible();
  await page.goto('/media/movie/911');
  await expect(page.getByLabel('Your notes')).toHaveValue('Memorable Tamil thriller');
  await expect(page.getByRole('combobox', { name: 'Watch status', exact: true })).toHaveValue(
    'Watched',
  );
});

test('partial search, disambiguation, duplicate protection, and mobile overflow', async ({
  page,
}) => {
  await mockMovies(page);
  await page.goto('/');
  const search = page.getByRole('combobox', {
    name: 'Search movies and TV series',
  });
  await search.fill('Interstel');
  await page.getByRole('button', { name: 'Add Interstellar (2022)' }).click();
  await search.fill('Drishyam');
  await expect(page.getByText('2013 · Malayalam · Movie')).toBeVisible();
  await expect(page.getByText('2015 · Hindi · Movie')).toBeVisible();
  await search.fill('Interstellar');
  await expect(page.getByRole('button', { name: 'Interstellar already saved' })).toBeDisabled();
  await search.press('Escape');
  await page.goto('/watchlist');
  await expect(page.getByRole('heading', { name: 'Interstellar', exact: true })).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('honest API errors and unsupported voice fallback', async ({ page }) => {
  await mockMovies(page);
  await page.route('**/api/search?**', (route) =>
    route.fulfill({
      status: 503,
      json: { error: 'Live movie search needs a TMDB API Read Access Token.' },
    }),
  );
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Search movies and TV series' }).fill('Vikram');
  await expect(page.getByRole('alert').filter({ hasText: 'TMDB API' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Search movies and TV series' }).press('Escape');
  await page.evaluate(() => {
    Object.defineProperty(window, 'SpeechRecognition', {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      value: undefined,
      configurable: true,
    });
  });
  await page.getByRole('button', { name: 'Start voice search', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Voice search is not supported' }),
  ).toBeVisible();
});

test('full JSON restore into a fresh database', async ({ page, context }) => {
  await mockMovies(page);
  await page.goto('/');
  await addVikram(page);
  await page.goto('/settings');
  const d = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const file = await (await d).path();
  /* A fresh browser context gives a true isolated IndexedDB origin. */ const fresh = await context
    .browser()!
    .newContext();
  const second = await fresh.newPage();
  await mockMovies(second);
  await second.goto('http://127.0.0.1:3000/settings');
  await second.getByLabel('Import backup file').setInputFiles(file!);
  await second.getByRole('button', { name: 'Merge backup', exact: true }).click();
  await expect(second.getByRole('status').filter({ hasText: 'Imported 1 titles' })).toBeVisible();
  await second.goto('http://127.0.0.1:3000/watchlist');
  await expect(second.getByRole('heading', { name: 'Vikram', exact: true })).toBeVisible();
  await fresh.close();
});

test('offline saved collection editing and full page reload', async ({ page, context }) => {
  await mockMovies(page);
  await page.goto('/');
  await addVikram(page);
  await page.goto('/media/movie/911');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  // Cache this exact navigation only after the installed worker controls it.
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Watch status', exact: true })).toHaveValue(
    'To Watch',
  );
  await context.setOffline(true);
  await page.getByRole('combobox', { name: 'Watch status', exact: true }).selectOption('Watching');
  await expect(page.getByRole('combobox', { name: 'Watch status', exact: true })).toHaveValue(
    'Watching',
  );
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Watch status', exact: true })).toHaveValue(
    'Watching',
  );
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Watch status', exact: true })).toHaveValue(
    'Watching',
  );
});
