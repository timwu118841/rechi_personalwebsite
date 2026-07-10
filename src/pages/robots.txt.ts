export function GET({ site }: { site: URL }) {
  const body = [
    `User-agent: *`,
    `Allow: /`,
    `Disallow: /keystatic/`,
    `Disallow: /search/`,
    `Sitemap: ${new URL('/sitemap-index.xml', site)}`,
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
