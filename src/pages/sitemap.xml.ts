import type { APIRoute } from 'astro';
import { getContentRepository } from '@/lib/content/repository';

export const prerender = false;
const escapeXml = (value: string) =>
  value.replace(
    /[<>&'"]/g,
    (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char]!,
  );

export const GET: APIRoute = async (context) => {
  const repository = getContentRepository();
  const [{ items: articles }, categories, tags] = await Promise.all([
    repository.listPublishedArticles({ pageSize: 1000 }),
    repository.listCategories(),
    repository.listTags(),
  ]);
  const base = context.site!;
  const urls = [
    '/',
    '/articles/',
    '/categories/',
    '/tags/',
    '/about/',
    ...articles.map((article) => `/articles/${article.slug}/`),
    ...categories.map((category) => `/categories/${category.slug}/`),
    ...tags.map((tag) => `/tags/${encodeURIComponent(tag.name)}/`),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((path) => `  <url><loc>${escapeXml(new URL(path, base).toString())}</loc></url>`).join('\n')}\n</urlset>`;
  if (context.cache.enabled)
    context.cache.set({
      maxAge: 86400,
      swr: 604800,
      tags: ['content', 'site-settings', 'sitemap'],
    });
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
