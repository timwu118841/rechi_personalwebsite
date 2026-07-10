import { describe, expect, it } from 'vitest';
import { pageCanonical, paginate, parsePage } from './pagination';

describe('pagination contract', () => {
  it('parses only positive integer page values', () => {
    expect(parsePage(null)).toBe(1);
    expect(parsePage('2')).toBe(2);
    expect(parsePage('0')).toBeNull();
    expect(parsePage('-1')).toBeNull();
    expect(parsePage('1.5')).toBeNull();
  });

  it('returns the requested nine-item page and totals', () => {
    const result = paginate(
      Array.from({ length: 20 }, (_, index) => index + 1),
      2,
      9,
    );
    expect(result.items).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18]);
    expect(result.totalItems).toBe(20);
    expect(result.totalPages).toBe(3);
  });

  it('removes redundant page one from canonical URLs', () => {
    const site = new URL('https://example.com');
    expect(pageCanonical('/articles/', 1, site)).toBe('https://example.com/articles/');
    expect(pageCanonical('/articles/', 2, site)).toBe('https://example.com/articles/?page=2');
  });
});
