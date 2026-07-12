import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getContentRepository } from '@/lib/content/repository';
import { articlePath } from '@/lib/content/slug';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const repository = getContentRepository();
  const [{ items: articles }, settings] = await Promise.all([
    repository.listPublishedArticles({ pageSize: 1000 }),
    repository.getSiteSettings(),
  ]);
  if (context.cache.enabled)
    context.cache.set({ maxAge: 86400, swr: 604800, tags: ['content', 'site-settings', 'rss'] });
  return rss({
    title: settings.siteTitle,
    description: settings.siteDescription,
    site: context.site!,
    items: articles.map((article) => ({
      title: article.title,
      description: article.description,
      pubDate: article.publishedAt,
      link: articlePath(article.slug),
      categories: [article.contentTypeName, article.categoryName, ...article.tags],
    })),
    customData: '<language>zh-TW</language>',
  });
};
