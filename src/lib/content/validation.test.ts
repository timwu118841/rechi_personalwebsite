import { describe, expect, it } from 'vitest';
import { articleInputSchema } from './validation';

const input = {
  slug: 'valid-article',
  title: '有效文章',
  description: '這是一段足夠長度而且可以清楚說明文章內容的摘要文字。',
  body: '完整文章內容',
  status: 'published' as const,
  publishedAt: '2026-07-10T00:00:00.000Z',
  contentType: 'legal-articles',
  category: 'legal-practice',
  tags: ['法律'],
  featured: false,
  privacyReviewed: true,
  legalReviewed: true,
};

describe('runtime article validation', () => {
  it('accepts a reviewed publishable article', () => {
    expect(articleInputSchema.parse(input).publishedAt).toBeInstanceOf(Date);
  });

  it('rejects an unsafe slug and unchecked publication', () => {
    expect(articleInputSchema.parse({ ...input, slug: '有 空格' }).slug).toBe('有-空格');
    expect(() => articleInputSchema.parse({ ...input, slug: '有_空格' })).toThrow();
    expect(() => articleInputSchema.parse({ ...input, privacyReviewed: false })).toThrow(
      /發布前必須完成隱私與法律內容檢查/,
    );
  });

  it('requires cover alternative text', () => {
    expect(() =>
      articleInputSchema.parse({
        ...input,
        cover: { url: 'https://example.com/cover.jpg', alt: '', width: 1600, height: 900 },
      }),
    ).toThrow();
  });

  it('accepts a rich body_json document when legacy Markdown is empty', () => {
    const result = articleInputSchema.parse({
      ...input,
      body: '',
      bodyJson: { type: 'doc', content: [{ type: 'paragraph', content: [] }] },
    });
    expect(result.body).toBe('');
  });

  it('rejects articles with neither legacy Markdown nor rich content', () => {
    expect(() => articleInputSchema.parse({ ...input, body: '', bodyJson: undefined })).toThrow(
      /文章內容不可為空/,
    );
  });
});
