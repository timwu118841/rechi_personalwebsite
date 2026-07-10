export type ArticleStatus = 'draft' | 'published' | 'unpublished';

export interface MediaAsset {
  url: string;
  alt: string;
  width: number;
  height: number;
}

export interface Category {
  slug: string;
  name: string;
  description: string;
  order: number;
  visible: boolean;
}

export interface ContentType {
  slug: string;
  name: string;
  description: string;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  status: ArticleStatus;
  publishedAt: Date;
  updatedAt?: Date;
  contentType: string;
  contentTypeName: string;
  category: string;
  categoryName: string;
  tags: string[];
  featured: boolean;
  cover?: MediaAsset;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  privacyReviewed: boolean;
  legalReviewed: boolean;
  createdAt: Date;
}

export interface SiteSettings {
  siteTitle: string;
  shortTitle: string;
  siteDescription: string;
  authorName: string;
  authorRole: string;
  authorBio: string;
  authorImage?: MediaAsset;
  defaultSocialImage?: MediaAsset;
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ArticleQuery {
  page?: number;
  pageSize?: number;
  category?: string;
  tag?: string;
}

export interface ContentRepository {
  listPublishedArticles(query?: ArticleQuery): Promise<PageResult<Article>>;
  getPublishedArticle(slug: string): Promise<Article | null>;
  searchPublishedArticles(query: string, limit?: number): Promise<Article[]>;
  listCategories(options?: { includeHidden?: boolean }): Promise<Category[]>;
  listContentTypes(): Promise<ContentType[]>;
  listTags(): Promise<Array<{ name: string; count: number }>>;
  getSiteSettings(): Promise<SiteSettings>;
  listAdminArticles(): Promise<Article[]>;
  getAdminArticle(id: string): Promise<Article | null>;
  saveArticle(input: ArticleInput, id?: string): Promise<Article>;
  saveSiteSettings(input: SiteSettingsInput): Promise<SiteSettings>;
  saveCategory(input: Category): Promise<Category>;
  saveContentType(input: ContentType): Promise<ContentType>;
  uploadImage(
    file: File,
    alt: string,
    dimensions: Pick<MediaAsset, 'width' | 'height'>,
  ): Promise<MediaAsset>;
}

export type ArticleInput = Omit<
  Article,
  'id' | 'contentTypeName' | 'categoryName' | 'createdAt' | 'updatedAt'
> & {
  updatedAt?: Date;
};

export type SiteSettingsInput = SiteSettings;
