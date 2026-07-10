import markdoc from '@astrojs/markdoc';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import keystatic from '@keystatic/astro';
import { defineConfig } from 'astro/config';

const site = process.env.SITE_URL || 'http://localhost:4321';

export default defineConfig({
  site,
  output: 'static',
  adapter: vercel(),
  integrations: [
    react(),
    markdoc(),
    keystatic(),
    sitemap({
      filter: (page) => !page.includes('/keystatic') && !page.includes('/search'),
    }),
  ],
  markdown: {
    shikiConfig: { theme: 'github-dark-default', wrap: true },
  },
  security: { checkOrigin: true },
  vite: {
    server: { fs: { allow: ['.'] } },
  },
});
