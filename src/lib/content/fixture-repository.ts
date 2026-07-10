import { getCollection } from 'astro:content';
import { isArticlePublic } from '@/lib/article-rules';
import { defaultSiteSettings } from './defaults';
import { paginate } from '@/lib/pagination';
import type {
  Article,
  ArticleInput,
  ArticleQuery,
  Category,
  ContentRepository,
  ContentType,
  MediaAsset,
  SiteSettings,
  SiteSettingsInput,
} from './types';

function idSlug(id: string): string {
  return (
    id
      .replace(/\/index$/, '')
      .replace(/\.(?:ya?ml|json)$/i, '')
      .split('/')
      .at(-1) || id
  );
}

function imageFromContent(image: unknown, alt: string): MediaAsset | undefined {
  if (!image || typeof image !== 'object' || !('src' in image)) return undefined;
  const value = image as { src: string; width?: number; height?: number };
  return {
    url: value.src,
    alt,
    width: value.width || 1600,
    height: value.height || 900,
  };
}

async function sourceData() {
  const [articleEntries, categoryEntries, contentTypeEntries] = await Promise.all([
    getCollection('articles'),
    getCollection('categories'),
    getCollection('contentTypes'),
  ]);
  const categories: Category[] = categoryEntries
    .map((entry) => ({ slug: idSlug(entry.id), ...entry.data }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'zh-TW'));
  const contentTypes: ContentType[] = contentTypeEntries
    .map((entry) => ({ slug: idSlug(entry.id), ...entry.data }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'));
  const categoryNames = new Map(categories.map((item) => [item.slug, item.name]));
  const contentTypeNames = new Map(contentTypes.map((item) => [item.slug, item.name]));
  const articles: Article[] = articleEntries.map((entry) => ({
    id: idSlug(entry.id),
    slug: idSlug(entry.id),
    title: entry.data.title,
    description: entry.data.description,
    body: entry.body || '',
    status: entry.data.status,
    publishedAt: entry.data.publishedAt,
    updatedAt: entry.data.updatedAt,
    contentType: entry.data.contentType,
    contentTypeName: contentTypeNames.get(entry.data.contentType) || entry.data.contentType,
    category: entry.data.category,
    categoryName: categoryNames.get(entry.data.category) || entry.data.category,
    tags: entry.data.tags,
    featured: entry.data.featured,
    cover: imageFromContent(entry.data.cover, entry.data.coverAlt || ''),
    seoTitle: entry.data.seoTitle,
    seoDescription: entry.data.seoDescription,
    canonicalUrl: entry.data.canonicalUrl,
    privacyReviewed: entry.data.privacyReviewed,
    legalReviewed: entry.data.legalReviewed,
    createdAt: entry.data.publishedAt,
  }));
  return { articles, categories, contentTypes };
}

function readonlyError(): never {
  throw new Error('本機 fixture 模式為唯讀；請設定 Supabase 環境變數後使用管理功能。');
}

export class FixtureContentRepository implements ContentRepository {
  async listPublishedArticles(query: ArticleQuery = {}) {
    const { articles } = await sourceData();
    const now = new Date();
    const filtered = articles
      .filter((article) => isArticlePublic({ data: article }, now))
      .filter((article) => !query.category || article.category === query.category)
      .filter((article) => !query.tag || article.tags.includes(query.tag))
      .sort((left, right) => right.publishedAt.getTime() - left.publishedAt.getTime());
    return paginate(filtered, query.page || 1, query.pageSize || 9);
  }

  async getPublishedArticle(slug: string) {
    const { articles } = await sourceData();
    return (
      articles.find(
        (article) => article.slug === slug && isArticlePublic({ data: article }, new Date()),
      ) || null
    );
  }

  async searchPublishedArticles(query: string, limit = 20) {
    const normalized = query.trim().toLocaleLowerCase('zh-Hant-TW');
    if (!normalized) return [];
    const { items } = await this.listPublishedArticles({ page: 1, pageSize: 1000 });
    return items
      .filter((article) =>
        [
          article.title,
          article.description,
          article.body,
          article.categoryName,
          article.contentTypeName,
          ...article.tags,
        ]
          .join(' ')
          .toLocaleLowerCase('zh-Hant-TW')
          .includes(normalized),
      )
      .slice(0, limit);
  }

  async listCategories(options: { includeHidden?: boolean } = {}) {
    const { categories } = await sourceData();
    return categories.filter((category) => options.includeHidden || category.visible);
  }

  async listContentTypes() {
    return (await sourceData()).contentTypes;
  }

  async listTags() {
    const { items } = await this.listPublishedArticles({ pageSize: 1000 });
    const counts = new Map<string, number>();
    for (const tag of items.flatMap((article) => article.tags)) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    return [...counts].map(([name, count]) => ({ name, count }));
  }

  async getSiteSettings() {
    return defaultSiteSettings;
  }

  async listAdminArticles() {
    return (await sourceData()).articles.sort(
      (left, right) => right.publishedAt.getTime() - left.publishedAt.getTime(),
    );
  }

  async getAdminArticle(id: string) {
    return (await sourceData()).articles.find((article) => article.id === id) || null;
  }

  async saveArticle(_input: ArticleInput, _id?: string): Promise<Article> {
    void _input;
    void _id;
    return readonlyError();
  }

  async saveSiteSettings(_input: SiteSettingsInput): Promise<SiteSettings> {
    void _input;
    return readonlyError();
  }

  async saveCategory(_input: Category): Promise<Category> {
    void _input;
    return readonlyError();
  }

  async saveContentType(_input: ContentType): Promise<ContentType> {
    void _input;
    return readonlyError();
  }

  async uploadImage(
    _file: File,
    _alt: string,
    _dimensions: Pick<MediaAsset, 'width' | 'height'>,
  ): Promise<MediaAsset> {
    void _file;
    void _alt;
    void _dimensions;
    return readonlyError();
  }
}
