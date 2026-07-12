import { defineConfig, devices } from '@playwright/test';

const fixturePort = Number(process.env.PLAYWRIGHT_PORT || 4321);
const guardedFixturePort = fixturePort + 1;
const fixtureBaseURL = `http://127.0.0.1:${fixturePort}`;
const guardedFixtureBaseURL = `http://127.0.0.1:${guardedFixturePort}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  testIgnore: '**/editor-fixture-guard.spec.ts',
  projects: [
    {
      name: 'desktop-chromium',
      testIgnore: /editor-fixture-guard\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: fixtureBaseURL },
    },
    {
      name: 'mobile-chromium',
      testIgnore: /editor-fixture-guard\.spec\.ts/,
      use: { ...devices['Pixel 7'], baseURL: fixtureBaseURL },
    },
    {
      name: 'fixture-guard',
      testMatch: /editor-fixture-guard\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: guardedFixtureBaseURL },
    },
  ],
  webServer: [
    {
      command: `PLAYWRIGHT_PORT=${fixturePort} ALLOW_FIXTURE_CONTENT=true ASTRO_TELEMETRY_DISABLED=1 node scripts/start-test-server.mjs`,
      url: fixtureBaseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `PLAYWRIGHT_PORT=${guardedFixturePort} ASTRO_TELEMETRY_DISABLED=1 node scripts/start-test-server.mjs`,
      url: guardedFixtureBaseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
