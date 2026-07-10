import rss from '@astrojs/rss';
import { siteConfig } from '@/config/site';
import {
  articleSlug,
  getCategoryMap,
  getContentTypeMap,
  getPublishedArticles,
} from '@/lib/articles';

export async function GET(context: { site: URL }) {
  const articles = await getPublishedArticles();
  const [categories, contentTypes] = await Promise.all([
    getCategoryMap({ includeHidden: true }),
    getContentTypeMap(),
  ]);
  return rss({
    title: siteConfig.name,
    description: siteConfig.description,
    site: context.site,
    items: articles.map((article) => ({
      title: article.data.title,
      description: article.data.description,
      pubDate: article.data.publishedAt,
      link: `/articles/${articleSlug(article)}/`,
      categories: [
        contentTypes.get(article.data.contentType)?.name || article.data.contentType,
        categories.get(article.data.category)?.name || article.data.category,
        ...article.data.tags,
      ],
    })),
    customData: '<language>zh-TW</language>',
  });
}
