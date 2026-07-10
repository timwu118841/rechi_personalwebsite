import markdoc from '@astrojs/markdoc';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import { cacheVercel } from '@astrojs/vercel/cache';
import { defineConfig } from 'astro/config';

const site = process.env.SITE_URL || 'http://localhost:4321';

export default defineConfig({
  site,
  output: 'server',
  adapter: vercel(),
  cache: { provider: cacheVercel() },
  integrations: [react(), markdoc()],
  markdown: {
    shikiConfig: { theme: 'github-dark-default', wrap: true },
  },
  security: { checkOrigin: true },
  vite: {
    server: { fs: { allow: ['.'] } },
  },
});
