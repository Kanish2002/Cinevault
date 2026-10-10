import { test, expect } from '@playwright/test';
import { fixture, row } from '../tests/fixtures';
import { cloudPrefsSchema, defaultPrefs } from '../types';

test('registers with a Gmail address and a separate app password, then signs out', async ({
  page,
}) => {
  let signedIn = false;
  let registered = false;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/config') return route.fulfill({ json: { cloud: true } });
    if (path === '/api/auth/get-session')
      return route.fulfill({
        json: signedIn
          ? {
              user: { id: 'new-user', email: 'person@gmail.com', name: 'person' },
              session: {
                id: 'session',
                userId: 'new-user',
                token: 'test',
                expiresAt: '2099-01-01T00:00:00Z',
              },
            }
          : null,
      });
    if (path === '/api/auth/sign-up/email') {
      expect(route.request().postDataJSON()).toMatchObject({
        email: 'person@gmail.com',
        password: 'cinevault-test-password',
        name: 'person',
      });
      registered = true;
      signedIn = true;
      return route.fulfill({
        json: { user: { id: 'new-user', email: 'person@gmail.com' }, token: 'test' },
      });
    }
    if (path === '/api/auth/sign-out') {
      signedIn = false;
      return route.fulfill({ json: { success: true } });
    }
    return route.fulfill({ json: { results: [] } });
  });
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('textbox', { name: 'Email address', exact: true }).fill('person@gmail.com');
  await page.getByLabel('CineVault password', { exact: true }).fill('cinevault-test-password');
  await page.getByLabel('Confirm password').fill('cinevault-test-password');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByText('Signed in as person@gmail.com')).toBeVisible();
  expect(registered).toBe(true);
  await expect(
    page.getByRole('checkbox', { name: 'Enable sync for this local vault' }),
  ).not.toBeChecked();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});

test('shows login errors and completes the email-code password recovery flow', async ({ page }) => {
  let resetRequested = false;
  let resetCompleted = false;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/config') return route.fulfill({ json: { cloud: true } });
    if (path === '/api/auth/get-session') return route.fulfill({ json: null });
    if (path === '/api/auth/sign-in/email')
      return route.fulfill({
        status: 401,
        json: { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' },
      });
    if (path === '/api/auth/email-otp/request-password-reset') {
      expect(route.request().postDataJSON()).toEqual({ email: 'person@gmail.com' });
      resetRequested = true;
      return route.fulfill({ json: { success: true } });
    }
    if (path === '/api/auth/email-otp/reset-password') {
      expect(route.request().postDataJSON()).toEqual({
        email: 'person@gmail.com',
        otp: '123456',
        password: 'new-cinevault-password',
      });
      resetCompleted = true;
      return route.fulfill({ json: { success: true } });
    }
    return route.fulfill({ json: { results: [] } });
  });
  await page.goto('/settings');
  await page.getByLabel('Email address', { exact: true }).fill('person@gmail.com');
  await page.getByLabel('CineVault password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Invalid email or password' })).toHaveText(
    'Invalid email or password',
  );
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(page.getByLabel('Email reset code')).toBeVisible();
  await page.getByLabel('Email reset code').fill('123456');
  await page.getByLabel('New CineVault password', { exact: true }).fill('new-cinevault-password');
  await page.getByLabel('Confirm password').fill('new-cinevault-password');
  await page.getByRole('button', { name: 'Set new password' }).click();
  await expect(page.getByText('Password updated. Sign in with your new password.')).toBeVisible();
  expect(resetRequested && resetCompleted).toBe(true);
});

test('signed-in account downloads its library and keeps edits after reload', async ({ page }) => {
  let calls = 0;
  const media = fixture();
  const entry = { ...row().entry, watchStatus: 'To Watch', notes: 'Synced from my laptop' };
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/config')
      return route.fulfill({ json: { tmdb: true, omdb: true, cloud: true } });
    if (url.pathname === '/api/auth/get-session')
      return route.fulfill({
        json: {
          user: { id: 'test-user', email: 'test@example.com', name: 'Test user' },
          session: {
            id: 'test-session',
            userId: 'test-user',
            expiresAt: '2099-01-01T00:00:00Z',
            token: 'test-token',
          },
        },
      });
    if (url.pathname === '/api/sync') {
      const body = route.request().postDataJSON();
      expect(body.expectedOwner).toBe('neon:test-user');
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
  await expect(page.getByRole('combobox', { name: 'Default watch status' })).toHaveValue(
    'Watching',
  );
  await page.goto(`/media/movie/${media.tmdbId}`);
  await expect(page.getByRole('textbox', { name: 'Your notes' })).toHaveValue(
    'Synced from my laptop',
  );
  await page.getByRole('combobox', { name: 'Watch status', exact: true }).selectOption('Watched');
  await expect(page.getByRole('combobox', { name: 'Watch status', exact: true })).toHaveValue(
    'Watched',
  );
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Watch status', exact: true })).toHaveValue(
    'Watched',
  );
  await expect(page.getByRole('textbox', { name: 'Your notes' })).toHaveValue(
    'Synced from my laptop',
  );
});
