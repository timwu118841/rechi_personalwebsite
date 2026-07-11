const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/u;
const INVALID = /[\u0000-\u001F\u007F\u2028\u2029\/?#%]/u;

export function normalizeSlug(value: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized || INVALID.test(normalized) || ZERO_WIDTH.test(normalized)) {
    throw new Error('網址代稱含有不支援的字元。');
  }
  const slug = Array.from(normalized)
    .map((character) => (/^[\p{L}\p{N}-]$/u.test(character) ? character : /\s/u.test(character) ? '-' : ''))
    .join('')
    .replace(/-+/g, '-');
  if (!slug || slug.startsWith('-') || slug.endsWith('-') || Array.from(slug).length > 120) {
    throw new Error('網址代稱必須是 1 至 120 個 Unicode 字元，且只能包含文字、數字與連字號。');
  }
  return slug;
}

export function slugFromTitle(title: string, fallback = 'article'): string {
  const normalized = title.normalize('NFC').trim();
  const generated = Array.from(normalized)
    .map((character) => (/^[\p{L}\p{N}]$/u.test(character) ? character : /\s/u.test(character) ? '-' : ''))
    .join('')
    .replace(/-+/g, '-');
  const value = generated.replace(/^-|-$/g, '').slice(0, 120).replace(/-$/, '');
  return value || `${fallback}-${crypto.randomUUID().slice(0, 8)}`;
}

export function withCollisionSuffix(base: string, index: number): string {
  if (index <= 1) return base;
  const suffix = `-${index}`;
  const room = Math.max(1, 120 - Array.from(suffix).length);
  return `${Array.from(base).slice(0, room).join('').replace(/-$/, '')}${suffix}`;
}
