import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT || 4332);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  projects: [{ name: 'fixture-guard-chromium', use: { ...devices['Desktop Chrome'] } }],
  use: { baseURL },
  webServer: {
    command: `env -u ALLOW_FIXTURE_CONTENT PLAYWRIGHT_PORT=${port} ASTRO_TELEMETRY_DISABLED=1 node scripts/start-test-server.mjs`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
