import { describe, expect, it } from 'vitest';
import {
  articleCacheTag,
  articlePath,
  decodeSlugPathParam,
  encodeSlugPathSegment,
  normalizeSlug,
  slugFromTitle,
  taxonomyCacheTag,
  withCollisionSuffix,
} from './slug';

describe('article slugs', () => {
  it('decodes encoded route params exactly once and tolerates malformed input', () => {
    expect(decodeSlugPathParam('%E7%A7%9F%E8%B3%83%E5%A5%91%E7%B4%84-%E6%B3%A8%E6%84%8F')).toBe(
      '租賃契約-注意',
    );
    expect(decodeSlugPathParam('租賃契約-注意')).toBe('租賃契約-注意');
    expect(decodeSlugPathParam('%E0%A4%A')).toBe('%E0%A4%A');
  });

  it('percent-encodes Chinese slugs for article paths', () => {
    expect(articlePath('租賃契約-注意')).toBe(
      '/articles/%E7%A7%9F%E8%B3%83%E5%A5%91%E7%B4%84-%E6%B3%A8%E6%84%8F/',
    );
    expect(encodeSlugPathSegment('租賃契約-注意')).toBe(
      '%E7%A7%9F%E8%B3%83%E5%A5%91%E7%B4%84-%E6%B3%A8%E6%84%8F',
    );
  });

  it('percent-encodes Chinese slugs in article cache tags', () => {
    expect(articleCacheTag('租賃契約-注意')).toBe(
      'article:%E7%A7%9F%E8%B3%83%E5%A5%91%E7%B4%84-%E6%B3%A8%E6%84%8F',
    );
  });

  it('accepts only lowercase English letters, digits and hyphens', () => {
    expect(normalizeSlug('Lease-Contract-Notes')).toBe('lease-contract-notes');
    expect(() => normalizeSlug('  租賃 lease   contract  ')).toThrow(
      '網址代稱只能使用小寫英文字母、數字與連字號。',
    );
    expect(normalizeSlug('lease--contract')).toBe('lease-contract');
  });

  it('generates an English title slug and a deterministic fallback for non-English titles', () => {
    expect(slugFromTitle('Lease Contract Notes')).toBe('lease-contract-notes');
    expect(slugFromTitle('租賃契約 注意事項')).toMatch(/^article-[0-9a-f]{8}$/);
    expect(slugFromTitle('租賃 lease')).toBe('lease');
    expect(withCollisionSuffix('lease-contract', 2)).toBe('lease-contract-2');
  });

  it('rejects unsafe characters and code-point overflow', () => {
    expect(() => normalizeSlug('bad/path')).toThrow();
    expect(() => normalizeSlug('foo_bar')).toThrow();
    expect(() => normalizeSlug('🙂')).toThrow();
    expect(() => normalizeSlug('bad\u200Bslug')).toThrow();
    expect(() => normalizeSlug('a'.repeat(121))).toThrow();
  });
});

describe('taxonomy cache tags', () => {
  it('percent-encodes reader-facing taxonomy names', () => {
    expect(taxonomyCacheTag('tag', '勞動法')).toBe('tag:%E5%8B%9E%E5%8B%95%E6%B3%95');
    expect(taxonomyCacheTag('category', 'legal-practice')).toBe('category:legal-practice');
  });

  it('produces values a cache tag header can carry', () => {
    // The Vercel cache provider joins every tag into the Vercel-Cache-Tag header,
    // whose values must be ByteStrings. A raw Chinese name throws there and the
    // page fails with a 500, so the encoded form is the contract.
    for (const tag of [
      taxonomyCacheTag('tag', '勞動法'),
      taxonomyCacheTag('category', '法律實務'),
    ]) {
      expect(() => new Headers({ 'Vercel-Cache-Tag': tag })).not.toThrow();
    }
    expect(() => new Headers({ 'Vercel-Cache-Tag': 'tag:勞動法' })).toThrow();
  });
});
