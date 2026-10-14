import { test, expect } from '@playwright/test';
import { result, fixture } from '../tests/fixtures';

test('mobile More exposes hidden routes; small portrait and landscape pages remain usable', async ({
  page,
}) => {
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/auth/')) return route.fulfill({ json: null });
    if (url.pathname === '/api/config')
      return route.fulfill({ json: { tmdb: true, cloud: false } });
    return route.fulfill({ json: { results: [], totalPages: 1 } });
  });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  await page.getByRole('button', { name: 'More navigation', exact: true }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Statistics', exact: true }).click();
  await expect(page).toHaveURL(/\/statistics$/);
  for (const route of [
    '/bulk',
    '/watchlist',
    '/watched',
    '/collections',
    '/settings',
    '/discover',
  ]) {
    await page.goto(route);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      route,
    ).toBe(true);
    await expect(page.getByRole('link', { name: 'Bulk Add', exact: true })).toBeVisible();
  }
  await page.setViewportSize({ width: 740, height: 360 });
  await page.goto('/bulk');
  await page.getByRole('textbox', { name: 'Movie titles', exact: true }).fill('Vikram');
  await expect(page.getByRole('button', { name: 'Find matches', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Escape followed by Enter cannot add a hidden search result', async ({ page }) => {
  let details = 0;
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/auth/')) return route.fulfill({ json: null });
    if (url.pathname === '/api/config') return route.fulfill({ json: { cloud: false } });
    if (url.pathname === '/api/search') return route.fulfill({ json: { results: [result()] } });
    if (url.pathname.startsWith('/api/media/')) {
      details++;
      return route.fulfill({ json: fixture() });
    }
    return route.fulfill({ json: { results: [], totalPages: 1 } });
  });
  await page.goto('/');
  const search = page.getByRole('combobox', { name: 'Search movies and TV series' });
  await search.fill('Vikram');
  await expect(page.getByRole('button', { name: 'Add Vikram (2022)' })).toBeVisible();
  await search.press('Escape');
  await search.press('Enter');
  await page.goto('/watchlist');
  expect(details).toBe(0);
  await expect(page.getByRole('heading', { name: 'Vikram', exact: true })).toHaveCount(0);
});
