import { getPublicContentRepository, type Article, type Category } from './content/repository';

export {
  formatDate,
  isArticlePublic,
  readingTimeMinutes,
  sortArticlesNewestFirst,
  taxonomyKey,
} from './article-rules';

export type ArticleEntry = Article;
export type CategorySummary = Category;
export type { ContentType as ContentTypeSummary } from './content/repository';

export function articleSlug(article: Pick<Article, 'slug'>): string {
  return article.slug;
}

export async function getPublishedArticles(now = new Date()): Promise<Article[]> {
  void now;
  return (await getPublicContentRepository().listPublishedArticles({ page: 1, pageSize: 1000 }))
    .items;
}

export async function getCategories(options: { includeHidden?: boolean } = {}) {
  return getPublicContentRepository().listCategories(options);
}

export async function getCategoryMap(options: { includeHidden?: boolean } = {}) {
  const categories = await getCategories(options);
  return new Map(categories.map((category) => [category.slug, category]));
}

export async function getContentTypes() {
  return getPublicContentRepository().listContentTypes();
}

export async function getContentTypeMap() {
  const contentTypes = await getContentTypes();
  return new Map(contentTypes.map((contentType) => [contentType.slug, contentType]));
}
