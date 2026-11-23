import { defineConfig } from '@playwright/test';

const browserNames = ['chromium', 'firefox', 'webkit'] as const;
const selectedBrowser = process.env.E2E_BROWSER;

if (selectedBrowser && !browserNames.includes(selectedBrowser as (typeof browserNames)[number])) {
  throw new Error(`Unsupported E2E_BROWSER: ${selectedBrowser}`);
}

const browsers = selectedBrowser
  ? [selectedBrowser as (typeof browserNames)[number]]
  : [...browserNames];
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],
  outputDir: 'test-results',
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure'
  },
  projects: browsers.map(browserName => ({
    name: browserName,
    use: { browserName }
  })),
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'node tests/e2e/static-server.mjs',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000
      }
});
