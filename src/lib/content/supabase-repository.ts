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
import { renderRichText } from './markdown';
import { slugFromTitle, withCollisionSuffix } from './slug';

type RecordRow = Record<string, any>;

function date(value: unknown): Date {
  return new Date(String(value));
}

function optionalDate(value: unknown): Date | undefined {
  return value ? date(value) : undefined;
}

function slugConflictError(field: 'slug' | 'old_slug' = 'slug') {
  const error = new Error('網址代稱已被使用，請更換後再儲存。') as Error & {
    code: string;
    field: string;
    constraint: string;
    detail: string;
  };
  error.code = '23505';
  error.field = field;
  error.constraint =
    field === 'slug' ? 'articles_slug_lower_unique' : 'article_slug_redirects_old_slug_key';
  error.detail = field;
  return error;
}

function slugConflictKind(error: unknown): 'slug' | 'old_slug' | null {
  const value = error as {
    code?: string;
    field?: string;
    constraint?: string;
    detail?: string;
    details?: string;
  };
  if (value?.code !== '23505') return null;
  if (
    value.field === 'old_slug' ||
    value.constraint?.includes('old_slug') ||
    value.detail === 'old_slug' ||
    value.details?.includes('old_slug')
  ) {
    return 'old_slug';
  }
  if (
    value.field === 'slug' ||
    value.constraint?.includes('slug') ||
    value.detail === 'slug' ||
    value.details?.includes('slug')
  ) {
    return 'slug';
  }
  return null;
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

export function articleFromRow(
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
    bodyJson: row.body_json || undefined,
    bodyHtml: row.body_html || undefined,
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

export function settingsFromRow(row: RecordRow): SiteSettings {
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

  async getArticleSlugRedirect(slug: string) {
    const { data, error } = await this.client
      .from('article_slug_redirects')
      .select('article_id')
      .eq('old_slug', slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const article = await this.getPublishedArticleById(String(data.article_id));
    return article?.slug || null;
  }

  private async getPublishedArticleById(id: string) {
    const [{ data, error }, maps] = await Promise.all([
      this.client
        .from('articles')
        .select('*')
        .eq('id', id)
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
        .or(
          `title.ilike.%${term}%,description.ilike.%${term}%,body_markdown.ilike.%${term}%,body_html.ilike.%${term}%`,
        )
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
    const previous = id
      ? await this.client.from('articles').select('slug').eq('id', id).maybeSingle()
      : { data: null, error: null };
    if (previous.error) throw previous.error;
    const manualSlug = input.slug;
    const generatedSlug = slugFromTitle(input.title, 'article');
    const isManualSlug = Boolean(manualSlug);
    let slug = isManualSlug ? manualSlug : generatedSlug;
    let collisionIndex = 2;
    if (isManualSlug) {
      const { data: existing, error: slugError } = await this.client
        .from('articles')
        .select('id,slug')
        .ilike('slug', slug);
      if (slugError) throw slugError;
      const conflict = (existing || []).find((row) => !id || String(row.id) !== id);
      if (conflict) throw slugConflictError('slug');
    } else {
      const { data: existing, error: slugError } = await this.client
        .from('articles')
        .select('id,slug')
        .ilike('slug', `${generatedSlug}%`);
      if (slugError) throw slugError;
      const taken = new Set(
        (existing || [])
          .filter((row) => !id || String(row.id) !== id)
          .map((row) => String(row.slug).toLocaleLowerCase()),
      );
      if (taken.has(slug.toLocaleLowerCase())) {
        while (taken.has(withCollisionSuffix(generatedSlug, collisionIndex).toLocaleLowerCase())) {
          collisionIndex += 1;
        }
        slug = withCollisionSuffix(generatedSlug, collisionIndex);
      }
    }
    const mapsPromise = this.taxonomyMaps();
    for (;;) {
      const request = this.client.rpc('save_article', {
        p_article_id: id || null,
        p_slug: slug,
        p_title: input.title,
        p_description: input.description,
        p_body_markdown: input.body || null,
        p_body_json: input.bodyJson || null,
        p_body_html: input.bodyJson ? renderRichText(input.bodyJson) : null,
        p_status: input.status,
        p_published_at: input.publishedAt.toISOString(),
        p_content_type_slug: input.contentType,
        p_category_slug: input.category,
        p_tags: input.tags,
        p_featured: input.featured,
        p_cover: input.cover || null,
        p_seo_title: input.seoTitle || null,
        p_seo_description: input.seoDescription || null,
        p_canonical_url: input.canonicalUrl || null,
        p_privacy_reviewed: input.privacyReviewed,
        p_legal_reviewed: input.legalReviewed,
      });
      const [{ data, error }, maps] = await Promise.all([request, mapsPromise]);
      if (error) {
        const conflictKind = slugConflictKind(error);
        if (generatedSlug && conflictKind === 'slug' && !isManualSlug) {
          collisionIndex += 1;
          slug = withCollisionSuffix(generatedSlug, collisionIndex);
          continue;
        }
        if (conflictKind) throw slugConflictError(conflictKind);
        throw error;
      }
      return articleFromRow(data, maps.categories, maps.contentTypes);
    }
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
