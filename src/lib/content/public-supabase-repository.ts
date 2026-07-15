import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { PublicSupabaseEnvironment } from './env';
import { articleFromRow, settingsFromRow } from './supabase-repository';
import type {
  Article,
  ArticleQuery,
  Category,
  ContentType,
  PageResult,
  SiteSettings,
} from './types';

type RecordRow = Record<string, any>;

/**
 * Read-only repository used by public pages.
 *
 * Keeping this adapter separate from the editorial repository makes the key
 * boundary explicit: public rendering never needs the service-role secret and
 * remains subject to Supabase RLS as a second line of defence.
 */
export class PublicContentRepository {
  private readonly client: SupabaseClient;

  constructor(environment: PublicSupabaseEnvironment) {
    this.client = createClient(environment.url, environment.publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  private async taxonomyMaps() {
    const [categories, contentTypes] = await Promise.all([
      this.listCategories(),
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
    const article = await this.client
      .from('articles')
      .select('slug,status,published_at')
      .eq('id', String(data.article_id))
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .maybeSingle();
    if (article.error) throw article.error;
    return article.data?.slug ? String(article.data.slug) : null;
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

  async listCategories(options: { includeHidden?: boolean } = {}): Promise<Category[]> {
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

  async listContentTypes(): Promise<ContentType[]> {
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

  async getSiteSettings(): Promise<SiteSettings> {
    const { data, error } = await this.client
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .single();
    if (error) throw error;
    return settingsFromRow(data as RecordRow);
  }
}
