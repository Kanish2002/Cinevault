import { test, expect } from '@playwright/test';
import { fixture, row } from '../tests/fixtures';
import { cloudPrefsSchema, defaultPrefs } from '../types';

test('Google sign-in button initiates the Google OAuth flow', async ({ page }) => {
  let googleRequested = false;
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/config')
      return route.fulfill({ json: { tmdb: true, omdb: true, cloud: true } });
    if (url.pathname === '/api/auth/session') return route.fulfill({ json: {} });
    if (url.pathname === '/api/auth/providers')
      return route.fulfill({
        json: {
          google: {
            id: 'google',
            name: 'Google',
            type: 'oauth',
            signinUrl: `${url.origin}/api/auth/signin/google`,
            callbackUrl: `${url.origin}/api/auth/callback/google`,
          },
        },
      });
    if (url.pathname === '/api/auth/csrf')
      return route.fulfill({ json: { csrfToken: 'test-csrf' } });
    if (url.pathname === '/api/auth/signin/google') {
      googleRequested = true;
      expect(route.request().method()).toBe('POST');
      expect(route.request().postData()).toContain('csrfToken=test-csrf');
      return route.fulfill({ json: { url: `${url.origin}/settings?oauth-started=google` } });
    }
    return route.fulfill({ json: { results: [] } });
  });
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page).toHaveURL(/oauth-started=google/);
  expect(googleRequested).toBe(true);
});

test('signed-in Google account downloads its library and keeps edits after reload', async ({
  page,
}) => {
  let calls = 0;
  const media = fixture();
  const entry = { ...row().entry, watchStatus: 'To Watch', notes: 'Synced from my laptop' };
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/config')
      return route.fulfill({ json: { tmdb: true, omdb: true, cloud: true } });
    if (url.pathname === '/api/auth/session')
      return route.fulfill({
        json: {
          user: { id: 'google:test-user', email: 'test@example.com', name: 'Test user' },
          expires: '2099-01-01T00:00:00Z',
        },
      });
    if (url.pathname === '/api/sync') {
      const body = route.request().postDataJSON();
      expect(body.expectedOwner).toBe('google:test-user');
      calls++;
      const records =
        calls === 1
          ? [
              {
                key: `media/${media.id}`,
                kind: 'media',
                recordId: media.id,
                payload: media,
                deleted: false,
                revision: 1,
                sequence: 1,
              },
              {
                key: `entries/${entry.id}`,
                kind: 'entries',
                recordId: entry.id,
                payload: entry,
                deleted: false,
                revision: 1,
                sequence: 2,
              },
              {
                key: 'preferences/main',
                kind: 'preferences',
                recordId: 'main',
                payload: {
                  ...cloudPrefsSchema.parse(defaultPrefs),
                  defaultWatchStatus: 'Watching',
                },
                deleted: false,
                revision: 1,
                sequence: 3,
              },
            ]
          : [];
      return route.fulfill({
        json: {
          accepted: body.changes.map((c: { key: string; mutationId: string }) => ({
            key: c.key,
            mutationId: c.mutationId,
            revision: 2,
          })),
          conflicts: [],
          records,
          cursor: 3,
          hasMore: false,
        },
      });
    }
    if (url.pathname.startsWith('/api/media/')) return route.fulfill({ json: media });
    return route.fulfill({ json: { results: [] } });
  });
  await page.goto('/settings');
  await expect(page.getByText('Signed in as test@example.com')).toBeVisible();
  const consent = page.getByRole('checkbox', { name: 'Enable sync for this local vault' });
  await consent.check();
  await expect.poll(() => calls).toBeGreaterThan(0);
  await expect(page.getByRole('combobox', { name: 'Default watch status' })).toHaveValue('Watching');
  await page.goto(`/media/movie/${media.tmdbId}`);
  await expect(page.getByRole('textbox', { name: 'Your notes' })).toHaveValue('Synced from my laptop');
  await page.getByRole('combobox', { name: 'Watch status', exact: true }).selectOption('Watched');
  await expect(page.getByRole('combobox', { name: 'Watch status', exact: true })).toHaveValue(
    'Watched',
  );
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Watch status', exact: true })).toHaveValue(
    'Watched',
  );
  await expect(page.getByRole('textbox', { name: 'Your notes' })).toHaveValue('Synced from my laptop');
});
