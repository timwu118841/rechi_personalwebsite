import type { APIRoute } from 'astro';
export const prerender = false;
export const GET: APIRoute = ({ site }) =>
  new Response(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin/',
      'Disallow: /api/admin/',
      'Disallow: /search/',
      `Sitemap: ${new URL('/sitemap.xml', site)}`,
    ].join('\n'),
    {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
