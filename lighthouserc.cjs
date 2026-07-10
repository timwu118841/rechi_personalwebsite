module.exports = {
  ci: {
    collect: {
      startServerCommand:
        'PLAYWRIGHT_PORT=4321 ALLOW_FIXTURE_CONTENT=true ASTRO_TELEMETRY_DISABLED=1 node scripts/start-test-server.mjs',
      startServerReadyPattern: 'Production test server ready',
      url: ['http://127.0.0.1:4321/', 'http://127.0.0.1:4321/articles/welcome/'],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        chromeFlags: '--no-sandbox --headless',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.95 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 1 }],
      },
    },
    upload: { target: 'temporary-public-storage' },
  },
};
