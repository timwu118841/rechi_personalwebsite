export interface PublishableArticleData {
  status: 'draft' | 'published' | 'unpublished';
  publishedAt: Date;
}

export function isArticlePublic<T extends { data: PublishableArticleData }>(
  article: T,
  now = new Date(),
): boolean {
  return article.data.status === 'published' && article.data.publishedAt.getTime() <= now.getTime();
}

export function sortArticlesNewestFirst<T extends { data: { publishedAt: Date } }>(
  articles: T[],
): T[] {
  return [...articles].sort(
    (left, right) => right.data.publishedAt.getTime() - left.data.publishedAt.getTime(),
  );
}

export function readingTimeMinutes(body: string): number {
  const latinWords = body.match(/[A-Za-z0-9]+/g)?.length ?? 0;
  const hanCharacters = body.match(/[\u3400-\u9FFF]/g)?.length ?? 0;
  return Math.max(1, Math.ceil(latinWords / 220 + hanCharacters / 450));
}

export function taxonomyKey(value: string): string {
  return encodeURIComponent(value.trim().toLocaleLowerCase('zh-Hant-TW'));
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Taipei',
  }).format(date);
}
