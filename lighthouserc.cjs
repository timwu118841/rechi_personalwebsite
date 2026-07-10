module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist/client',
      url: ['http://localhost/', 'http://localhost/articles/welcome/'],
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
