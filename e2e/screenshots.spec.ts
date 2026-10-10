import { test, expect } from '@playwright/test';
test('unconfigured production shell renders without runtime errors or viewport overflow', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Your cinema/ })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Search movies and TV series' })).toBeVisible();
  await page.waitForTimeout(1200);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `docs/${info.project.name}.png`, fullPage: true });
});
