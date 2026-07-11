import { describe, expect, it } from 'vitest';
import { normalizeSlug, slugFromTitle, withCollisionSuffix } from './slug';

describe('unicode article slugs', () => {
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
