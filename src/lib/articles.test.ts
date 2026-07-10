import { describe, expect, it } from 'vitest';
import { isArticlePublic, readingTimeMinutes, sortArticlesNewestFirst } from './article-rules';

function article(status: 'draft' | 'published' | 'unpublished', publishedAt: string) {
  return { data: { status, publishedAt: new Date(publishedAt) } } as never;
}

describe('article publication rules', () => {
  const now = new Date('2026-07-10T00:00:00Z');

  it('only exposes eligible published articles', () => {
    expect(isArticlePublic(article('published', '2026-07-09'), now)).toBe(true);
    expect(isArticlePublic(article('draft', '2026-07-09'), now)).toBe(false);
    expect(isArticlePublic(article('unpublished', '2026-07-09'), now)).toBe(false);
    expect(isArticlePublic(article('published', '2026-07-11'), now)).toBe(false);
  });

  it('sorts newest articles first without mutating the input', () => {
    const older = article('published', '2026-07-01');
    const newer = article('published', '2026-07-09');
    const input = [older, newer] as never[];
    expect(sortArticlesNewestFirst(input)).toEqual([newer, older]);
    expect(input).toEqual([older, newer]);
  });
});

describe('reading time', () => {
  it('returns at least one minute', () => {
    expect(readingTimeMinutes('短文')).toBe(1);
  });

  it('counts long Chinese content', () => {
    expect(readingTimeMinutes('法'.repeat(901))).toBe(3);
  });
});
