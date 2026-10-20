const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/u;
// Article slugs are English-only by product decision: lowercase ASCII letters,
// digits and single hyphens. Existing unicode slugs (and their redirects) are
// still readable through the decode/encode helpers below.
const ALLOWED = /^[a-z0-9-]$/;
const SLUG_MAX_LENGTH = 120;

/**
 * Astro may expose rest-route params in either encoded or decoded form,
 * depending on the adapter/request path. Decode exactly once so Unicode
 * slugs are looked up consistently without turning malformed URLs into 500s.
 */
export function decodeSlugPathParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function encodeSlugPathSegment(value: string): string {
  return encodeURIComponent(value);
}

export function articleCacheTag(slug: string): string {
  return `article:${encodeURIComponent(slug)}`;
}

/**
 * Taxonomy names are reader-facing and usually non-ASCII. Cache tags travel in an
 * HTTP header, whose values must be ByteStrings, so a raw Chinese tag name makes
 * the cache provider throw and the page fail with a 500. Encode every tag name.
 */
export function taxonomyCacheTag(kind: 'tag' | 'category', value: string): string {
  return `${kind}:${encodeURIComponent(value)}`;
}

export function articlePath(slug: string): string {
  return `/articles/${encodeSlugPathSegment(slug)}/`;
}

export function normalizeSlug(value: string): string {
  const normalized = value.normalize('NFC').trim().toLowerCase();
  if (!normalized || ZERO_WIDTH.test(normalized)) {
    throw new Error('網址代稱含有不支援的字元。');
  }
  const slug = Array.from(normalized)
    .map((character) => {
      if (/\s/u.test(character)) return '-';
      if (ALLOWED.test(character)) return character;
      throw new Error('網址代稱只能使用小寫英文字母、數字與連字號。');
    })
    .join('')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!slug || slug.length > SLUG_MAX_LENGTH) {
    throw new Error('網址代稱必須是 1 至 120 個小寫英文字母、數字與連字號。');
  }
  return slug;
}

/**
 * Derive an English slug from a title. Non-ASCII characters are dropped, so a
 * Chinese title yields the fallback slug and the admin should set the slug
 * explicitly on the publishing step.
 */
export function slugFromTitle(title: string, fallback = 'article'): string {
  const normalized = title.normalize('NFC').trim().toLowerCase();
  const generated = Array.from(normalized)
    .map((character) => {
      if (/\s/u.test(character)) return '-';
      if (ALLOWED.test(character)) return character;
      return '';
    })
    .join('')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const value = generated.slice(0, SLUG_MAX_LENGTH).replace(/-$/, '');
  return value || `${fallback}-${crypto.randomUUID().slice(0, 8)}`;
}

export function withCollisionSuffix(base: string, index: number): string {
  if (index <= 1) return base;
  const suffix = `-${index}`;
  const room = Math.max(1, 120 - Array.from(suffix).length);
  return `${Array.from(base).slice(0, room).join('').replace(/-$/, '')}${suffix}`;
}
