import { getCollection, type CollectionEntry } from 'astro:content';
import { isArticlePublic, sortArticlesNewestFirst } from './article-rules';

export {
  formatDate,
  isArticlePublic,
  readingTimeMinutes,
  sortArticlesNewestFirst,
  taxonomyKey,
} from './article-rules';

export type ArticleEntry = CollectionEntry<'articles'>;
export type CategoryEntry = CollectionEntry<'categories'>;
export type ContentTypeEntry = CollectionEntry<'contentTypes'>;

export interface CategorySummary {
  slug: string;
  name: string;
  description: string;
  order: number;
  visible: boolean;
}

export interface ContentTypeSummary {
  slug: string;
  name: string;
  description: string;
}

export function articleSlug(article: Pick<ArticleEntry, 'id'>): string {
  return article.id.replace(/\/index$/, '');
}

export async function getPublishedArticles(now = new Date()): Promise<ArticleEntry[]> {
  const [articles, categories, contentTypes] = await Promise.all([
    getCollection('articles'),
    getCollection('categories'),
    getCollection('contentTypes'),
  ]);
  const categorySlugs = new Set(categories.map(categorySlug));
  const contentTypeSlugs = new Set(contentTypes.map(contentTypeSlug));
  const orphanedArticle = articles.find((article) => !categorySlugs.has(article.data.category));
  if (orphanedArticle) {
    throw new Error(
      `文章「${orphanedArticle.data.title}」指定了不存在的分類「${orphanedArticle.data.category}」。請先在後台建立分類或重新選取分類。`,
    );
  }
  const articleWithoutType = articles.find(
    (article) => !contentTypeSlugs.has(article.data.contentType),
  );
  if (articleWithoutType) {
    throw new Error(
      `文章「${articleWithoutType.data.title}」指定了不存在的內容類型「${articleWithoutType.data.contentType}」。請先在後台建立內容類型或重新選取。`,
    );
  }
  return sortArticlesNewestFirst(articles.filter((article) => isArticlePublic(article, now)));
}

export function categorySlug(category: Pick<CategoryEntry, 'id'>): string {
  return (
    category.id
      .replace(/\.(?:ya?ml|json)$/i, '')
      .split('/')
      .at(-1) || category.id
  );
}

export async function getCategories(options: { includeHidden?: boolean } = {}) {
  const categories = await getCollection('categories');
  return categories
    .map((category): CategorySummary => ({
      slug: categorySlug(category),
      name: category.data.name,
      description: category.data.description,
      order: category.data.order,
      visible: category.data.visible,
    }))
    .filter((category) => options.includeHidden || category.visible)
    .sort(
      (left, right) => left.order - right.order || left.name.localeCompare(right.name, 'zh-TW'),
    );
}

export async function getCategoryMap(options: { includeHidden?: boolean } = {}) {
  const categories = await getCategories(options);
  return new Map(categories.map((category) => [category.slug, category]));
}

export function contentTypeSlug(contentType: Pick<ContentTypeEntry, 'id'>): string {
  return (
    contentType.id
      .replace(/\.(?:ya?ml|json)$/i, '')
      .split('/')
      .at(-1) || contentType.id
  );
}

export async function getContentTypes() {
  const contentTypes = await getCollection('contentTypes');
  return contentTypes
    .map((contentType): ContentTypeSummary => ({
      slug: contentTypeSlug(contentType),
      name: contentType.data.name,
      description: contentType.data.description,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-TW'));
}

export async function getContentTypeMap() {
  const contentTypes = await getContentTypes();
  return new Map(contentTypes.map((contentType) => [contentType.slug, contentType]));
}
