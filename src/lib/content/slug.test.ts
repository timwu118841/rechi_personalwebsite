import { describe, expect, it } from 'vitest';
import {
  articleCacheTag,
  articlePath,
  decodeSlugPathParam,
  encodeSlugPathSegment,
  normalizeSlug,
  slugFromTitle,
  withCollisionSuffix,
} from './slug';

describe('unicode article slugs', () => {
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

  it('normalizes NFC and supports Chinese and Latin text', () => {
    expect(normalizeSlug('租賃契約注意事項')).toBe('租賃契約注意事項');
    expect(normalizeSlug('e\u0301-契約')).toBe('é-契約');
    expect(normalizeSlug('  租賃   契約  注意事項  ')).toBe('租賃-契約-注意事項');
  });

  it('generates title slugs and deterministic collision suffixes', () => {
    expect(slugFromTitle('租賃契約 注意事項')).toBe('租賃契約-注意事項');
    expect(withCollisionSuffix('租賃契約注意事項', 2)).toBe('租賃契約注意事項-2');
  });

  it('rejects unsafe characters and code-point overflow', () => {
    expect(() => normalizeSlug('bad/path')).toThrow();
    expect(() => normalizeSlug('foo_bar')).toThrow();
    expect(() => normalizeSlug('🙂')).toThrow();
    expect(() => normalizeSlug('bad\u200Bslug')).toThrow();
    expect(() => normalizeSlug('a'.repeat(121))).toThrow();
  });
});
