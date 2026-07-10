import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseEnvironment } from './env';
import type {
  Article,
  ArticleInput,
  ArticleQuery,
  Category,
  ContentRepository,
  ContentType,
  MediaAsset,
  PageResult,
  SiteSettings,
  SiteSettingsInput,
} from './types';

type RecordRow = Record<string, any>;

function date(value: unknown): Date {
  return new Date(String(value));
}

function optionalDate(value: unknown): Date | undefined {
  return value ? date(value) : undefined;
}

function media(value: unknown): MediaAsset | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as RecordRow;
  if (!item.url) return undefined;
  return {
    url: String(item.url),
    alt: String(item.alt || ''),
    width: Number(item.width || 1600),
    height: Number(item.height || 900),
  };
}

function articleFromRow(
  row: RecordRow,
  categories: Map<string, string>,
  contentTypes: Map<string, string>,
): Article {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    description: String(row.description),
    body: String(row.body_markdown || ''),
    status: row.status,
    publishedAt: date(row.published_at),
    updatedAt: optionalDate(row.updated_at),
    contentType: String(row.content_type_slug),
    contentTypeName:
      contentTypes.get(String(row.content_type_slug)) || String(row.content_type_slug),
    category: String(row.category_slug),
    categoryName: categories.get(String(row.category_slug)) || String(row.category_slug),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    featured: Boolean(row.featured),
    cover: media(row.cover),
    seoTitle: row.seo_title || undefined,
    seoDescription: row.seo_description || undefined,
    canonicalUrl: row.canonical_url || undefined,
    privacyReviewed: Boolean(row.privacy_reviewed),
    legalReviewed: Boolean(row.legal_reviewed),
    createdAt: date(row.created_at),
  };
}

function settingsFromRow(row: RecordRow): SiteSettings {
  return {
    siteTitle: String(row.site_title),
    shortTitle: String(row.short_title),
    siteDescription: String(row.site_description),
    authorName: String(row.author_name),
    authorRole: String(row.author_role),
    authorBio: String(row.author_bio),
    authorImage: media(row.author_image),
    defaultSocialImage: media(row.default_social_image),
  };
}

export class SupabaseContentRepository implements ContentRepository {
  private client: SupabaseClient;

  constructor(environment: SupabaseEnvironment) {
    this.client = createClient(environment.url, environment.secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  private async taxonomyMaps() {
    const [categories, contentTypes] = await Promise.all([
      this.listCategories({ includeHidden: true }),
      this.listContentTypes(),
    ]);
    return {
      categories: new Map(categories.map((item) => [item.slug, item.name])),
      contentTypes: new Map(contentTypes.map((item) => [item.slug, item.name])),
    };
  }

  async listPublishedArticles(query: ArticleQuery = {}): Promise<PageResult<Article>> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(1000, Math.max(1, query.pageSize || 9));
    const from = (page - 1) * pageSize;
    let request = this.client
      .from('articles')
      .select('*', { count: 'exact' })
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (query.category) request = request.eq('category_slug', query.category);
    if (query.tag) request = request.contains('tags', [query.tag]);
    const [{ data, error, count }, maps] = await Promise.all([request, this.taxonomyMaps()]);
    if (error) throw error;
    const totalItems = count || 0;
    return {
      items: (data || []).map((row) => articleFromRow(row, maps.categories, maps.contentTypes)),
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    };
  }

  async getPublishedArticle(slug: string) {
    const [{ data, error }, maps] = await Promise.all([
      this.client
        .from('articles')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .lte('published_at', new Date().toISOString())
        .maybeSingle(),
      this.taxonomyMaps(),
    ]);
    if (error) throw error;
    return data ? articleFromRow(data, maps.categories, maps.contentTypes) : null;
  }

  async searchPublishedArticles(query: string, limit = 20) {
    const term = query.trim().replace(/[,%()]/g, ' ');
    if (!term) return [];
    const [{ data, error }, maps] = await Promise.all([
      this.client
        .from('articles')
        .select('*')
        .eq('status', 'published')
        .lte('published_at', new Date().toISOString())
        .or(`title.ilike.%${term}%,description.ilike.%${term}%,body_markdown.ilike.%${term}%`)
        .order('published_at', { ascending: false })
        .limit(Math.min(50, limit)),
      this.taxonomyMaps(),
    ]);
    if (error) throw error;
    return (data || []).map((row) => articleFromRow(row, maps.categories, maps.contentTypes));
  }

  async listCategories(options: { includeHidden?: boolean } = {}) {
    let request = this.client.from('categories').select('*').order('display_order').order('name');
    if (!options.includeHidden) request = request.eq('visible', true);
    const { data, error } = await request;
    if (error) throw error;
    return (data || []).map((row) => ({
      slug: String(row.slug),
      name: String(row.name),
      description: String(row.description),
      order: Number(row.display_order),
      visible: Boolean(row.visible),
    }));
  }

  async listContentTypes() {
    const { data, error } = await this.client.from('content_types').select('*').order('name');
    if (error) throw error;
    return (data || []).map((row) => ({
      slug: String(row.slug),
      name: String(row.name),
      description: String(row.description),
    }));
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
    const { data, error } = await this.client
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .single();
    if (error) throw error;
    return settingsFromRow(data);
  }

  async listAdminArticles() {
    const [{ data, error }, maps] = await Promise.all([
      this.client.from('articles').select('*').order('updated_at', { ascending: false }),
      this.taxonomyMaps(),
    ]);
    if (error) throw error;
    return (data || []).map((row) => articleFromRow(row, maps.categories, maps.contentTypes));
  }

  async getAdminArticle(id: string) {
    const [{ data, error }, maps] = await Promise.all([
      this.client.from('articles').select('*').eq('id', id).maybeSingle(),
      this.taxonomyMaps(),
    ]);
    if (error) throw error;
    return data ? articleFromRow(data, maps.categories, maps.contentTypes) : null;
  }

  async saveArticle(input: ArticleInput, id?: string) {
    const values = {
      slug: input.slug,
      title: input.title,
      description: input.description,
      body_markdown: input.body,
      status: input.status,
      published_at: input.publishedAt.toISOString(),
      content_type_slug: input.contentType,
      category_slug: input.category,
      tags: input.tags,
      featured: input.featured,
      cover: input.cover || null,
      seo_title: input.seoTitle || null,
      seo_description: input.seoDescription || null,
      canonical_url: input.canonicalUrl || null,
      privacy_reviewed: input.privacyReviewed,
      legal_reviewed: input.legalReviewed,
      updated_at: new Date().toISOString(),
    };
    const request = id
      ? this.client.from('articles').update(values).eq('id', id).select('*').single()
      : this.client.from('articles').insert(values).select('*').single();
    const [{ data, error }, maps] = await Promise.all([request, this.taxonomyMaps()]);
    if (error) throw error;
    return articleFromRow(data, maps.categories, maps.contentTypes);
  }

  async saveSiteSettings(input: SiteSettingsInput) {
    const { data, error } = await this.client
      .from('site_settings')
      .upsert({
        id: 1,
        site_title: input.siteTitle,
        short_title: input.shortTitle,
        site_description: input.siteDescription,
        author_name: input.authorName,
        author_role: input.authorRole,
        author_bio: input.authorBio,
        author_image: input.authorImage || null,
        default_social_image: input.defaultSocialImage || null,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (error) throw error;
    return settingsFromRow(data);
  }

  async saveCategory(input: Category) {
    const { data, error } = await this.client
      .from('categories')
      .upsert({
        slug: input.slug,
        name: input.name,
        description: input.description,
        display_order: input.order,
        visible: input.visible,
      })
      .select('*')
      .single();
    if (error) throw error;
    return {
      slug: data.slug,
      name: data.name,
      description: data.description,
      order: data.display_order,
      visible: data.visible,
    };
  }

  async saveContentType(input: ContentType) {
    const { data, error } = await this.client
      .from('content_types')
      .upsert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async uploadImage(file: File, alt: string, dimensions: Pick<MediaAsset, 'width' | 'height'>) {
    const extension = new Map([
      ['image/jpeg', 'jpg'],
      ['image/png', 'png'],
      ['image/webp', 'webp'],
      ['image/avif', 'avif'],
    ]).get(file.type);
    if (!extension) throw new Error('不支援的圖片格式。');
    const path = `uploads/${new Date().getUTCFullYear()}/${crypto.randomUUID()}.${extension}`;
    const { error } = await this.client.storage.from('site-media').upload(path, file, {
      contentType: file.type,
      cacheControl: '31536000',
      upsert: false,
    });
    if (error) throw error;
    const { data } = this.client.storage.from('site-media').getPublicUrl(path);
    return { url: data.publicUrl, alt, ...dimensions };
  }
}
