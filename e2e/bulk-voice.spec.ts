import { test, expect, type Page } from '@playwright/test';
import { fixture, result } from '../tests/fixtures';

async function movies(page: Page) {
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/auth/')) return route.fulfill({ json: null });
    if (url.pathname === '/api/config')
      return route.fulfill({ json: { tmdb: true, cloud: false } });
    if (url.pathname === '/api/search') {
      const query = url.searchParams.get('q') || '';
      const results =
        query === 'Drishyam'
          ? [
              { ...result(1, 'ml', 'Drishyam'), releaseDate: '2013-12-19' },
              { ...result(2, 'hi', 'Drishyam'), releaseDate: '2015-07-31' },
            ]
          : [result(911, 'ta', 'Vikram')];
      return route.fulfill({ json: { results } });
    }
    if (url.pathname.startsWith('/api/media/')) {
      const id = Number(url.pathname.split('/')[4]);
      return route.fulfill({ json: id === 2 ? fixture(id, 'hi', 'Drishyam') : fixture() });
    }
    return route.fulfill({ json: { results: [], totalPages: 1 } });
  });
}
async function fakeSpeech(page: Page) {
  await page.addInitScript(() => {
    type Result = { isFinal: boolean; 0: { transcript: string } };
    class Speech {
      lang = '';
      continuous = false;
      interimResults = false;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onresult: ((event: { resultIndex: number; results: Result[] }) => void) | null = null;
      results: Result[] = [];
      start() {
        harness.current = this;
        harness.starts++;
        queueMicrotask(() => this.onstart?.());
      }
      stop() {
        harness.stops++;
        this.onend?.();
      }
      abort() {
        harness.aborts++;
        this.onend?.();
      }
    }
    const harness = {
      current: null as Speech | null,
      starts: 0,
      stops: 0,
      aborts: 0,
      emit(text: string, final: boolean) {
        const current = this.current!;
        const last = current.results.at(-1);
        const index = last && !last.isFinal ? current.results.length - 1 : current.results.length;
        current.results[index] = { isFinal: final, 0: { transcript: text } };
        current.onresult?.({ resultIndex: index, results: current.results });
      },
      error(code: string) {
        this.current?.onerror?.({ error: code });
      },
    };
    Object.defineProperty(window, 'SpeechRecognition', { value: Speech, configurable: true });
    Object.defineProperty(window, 'speechQA', { value: harness });
  });
}
type VoiceWindow = Window & {
  speechQA: {
    emit: (text: string, final: boolean) => void;
    error: (code: string) => void;
    stops: number;
    aborts: number;
    current: { lang: string; continuous: boolean };
  };
};
const emit = (page: Page, text: string, final = true) =>
  page.evaluate(
    ({ text, final }) => (window as unknown as VoiceWindow).speechQA.emit(text, final),
    {
      text,
      final,
    },
  );

test('mobile Bulk Add shortcut and poster picker disambiguate a title before saving', async ({
  page,
}, info) => {
  await movies(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await page.getByRole('link', { name: 'Bulk Add', exact: true }).click();
  await expect(page).toHaveURL(/\/bulk$/);
  await page.getByRole('textbox', { name: 'Movie titles', exact: true }).fill('Drishyam');
  await page.getByRole('button', { name: 'Find matches', exact: true }).click();
  await page.getByRole('button', { name: 'Match for Drishyam: Choose a match' }).click();
  const dialog = page.getByRole('dialog', { name: 'Matches for Drishyam' });
  await expect(dialog.getByText('Malayalam', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Hindi', { exact: true })).toBeVisible();
  await page.screenshot({
    path: `/tmp/cinevault-bulk-picker-${info.project.name}.png`,
    fullPage: false,
  });
  await dialog.getByLabel('Filter matches').fill('2015');
  await expect(dialog.getByRole('button', { name: /Drishyam.*2013/ })).toHaveCount(0);
  await dialog.getByRole('button', { name: /Drishyam.*2015.*Hindi/ }).click();
  const trigger = page.getByRole('button', { name: 'Match for Drishyam: Drishyam, 2015, Hindi' });
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save selected matches' })).toBeDisabled();
  await page.getByRole('button', { name: 'Match for Drishyam: Choose a match' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Drishyam.*2015.*Hindi/ })
    .click();
  await page.getByRole('button', { name: 'Save selected matches' }).click();
  await expect(page.getByRole('status').filter({ hasText: '1 added' })).toBeVisible();
  await page.goto('/watchlist');
  await expect(page.getByRole('heading', { name: 'Drishyam', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 700 });
  await expect(page.getByRole('link', { name: 'Bulk Add', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('bulk dictation appends final titles once, preserves typed text, and stops visibly', async ({
  page,
}) => {
  await movies(page);
  await fakeSpeech(page);
  await page.goto('/bulk');
  await page.getByRole('textbox', { name: 'Movie titles', exact: true }).fill('Interstellar');
  await page.getByRole('button', { name: 'Dictate movie titles' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Listening…' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Find matches', exact: true })).toBeDisabled();
  await emit(page, 'Vik', false);
  await expect(page.getByRole('status').filter({ hasText: 'Listening…' })).toContainText('Vik');
  await expect(page.getByRole('textbox', { name: 'Movie titles', exact: true })).toHaveValue(
    'Interstellar',
  );
  await emit(page, 'Vikram');
  await emit(page, 'Kaithi new line Drishyam');
  await expect(page.getByRole('textbox', { name: 'Movie titles', exact: true })).toHaveValue(
    'Interstellar\nVikram\nKaithi\nDrishyam',
  );
  await page.getByRole('button', { name: 'Stop dictating movie titles' }).click();
  await expect(page.getByRole('button', { name: 'Dictate movie titles' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as VoiceWindow).speechQA.stops)).toBe(1);
  await expect(page.getByRole('button', { name: 'Find matches', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Dictate movie titles' }).click();
  await emit(page, 'Parasite');
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Your cinema/ })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as VoiceWindow).speechQA.aborts))
    .toBeGreaterThan(0);
});

test('search mic exposes Listening and Stop and recovers from denied permission', async ({
  page,
}) => {
  await movies(page);
  await fakeSpeech(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start voice search', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Listening…' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start voice search', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start voice search', exact: true }).click();
  await emit(page, 'search for Vikram');
  await page.getByRole('button', { name: 'Stop voice search', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Search movies and TV series' })).toHaveValue(
    'Vikram',
  );
  await page.goto('/bulk');
  await page.getByRole('button', { name: 'Dictate movie titles' }).click();
  await page.evaluate(() => (window as unknown as VoiceWindow).speechQA.error('not-allowed'));
  await expect(page.getByRole('status').filter({ hasText: 'permission was denied' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dictate movie titles' })).toBeEnabled();
  await page.getByRole('textbox', { name: 'Movie titles', exact: true }).fill('Vikram');
  await expect(page.getByRole('button', { name: 'Find matches', exact: true })).toBeEnabled();
});

test('bulk mobile speech replay and natural endings do not duplicate titles or strand Stop', async ({ page }) => {
  await movies(page);
  await fakeSpeech(page);
  await page.goto('/bulk');
  await page.getByLabel('Dictation language').selectOption('ta-IN');
  await page.getByRole('button', { name: 'Dictate movie titles' }).click();
  await emit(page, 'Vikram');
  await page.evaluate(() => {
    const s = (window as unknown as { speechQA: { current: { results: unknown[]; onresult: (e: unknown) => void; onend: () => void } } }).speechQA.current;
    s.onresult({ resultIndex: 0, results: s.results });
    s.onend();
  });
  await expect(page.getByRole('status').filter({ hasText: 'Listening…' })).toBeVisible();
  await emit(page, 'Kaithi');
  await page.getByRole('button', { name: 'Stop dictating movie titles' }).click();
  await expect(page.getByLabel('Movie titles', { exact: true })).toHaveValue('Vikram\nKaithi');
  await expect(page.getByRole('button', { name: 'Find matches', exact: true })).toBeEnabled();
});

test('editing a matched batch invalidates stale selections and over-limit input stays intact', async ({ page }) => {
  await movies(page);
  await page.goto('/bulk');
  const input = page.getByLabel('Movie titles', { exact: true });
  await input.fill('Vikram');
  await page.getByRole('button', { name: 'Find matches', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save selected matches' })).toBeEnabled();
  await input.fill('Kaithi');
  await expect(page.getByRole('button', { name: 'Save selected matches' })).toBeDisabled();
  const large = Array.from({ length: 201 }, (_, i) => `Title ${i}`).join('\n');
  await input.fill(large);
  await page.getByRole('button', { name: 'Find matches', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '200 titles or fewer' })).toBeVisible();
  await expect(input).toHaveValue(large);
});
