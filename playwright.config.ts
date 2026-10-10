import { defineConfig, devices } from '@playwright/test';
const localUrl = `http://127.0.0.1:${process.env.E2E_PORT || '3000'}`;
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: process.env.BASE_URL || localUrl,
    trace: 'retain-on-failure',
    launchOptions: process.env.CHROMIUM_PATH
      ? {
          executablePath: process.env.CHROMIUM_PATH,
          args: ['--no-sandbox', '--disable-dev-shm-usage'],
        }
      : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'android',
      use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `npm run start -- --port ${process.env.E2E_PORT || '3000'}`,
        url: localUrl,
        reuseExistingServer: !process.env.CI,
      },
  reporter: [['list'], ['html', { open: 'never' }]],
});
