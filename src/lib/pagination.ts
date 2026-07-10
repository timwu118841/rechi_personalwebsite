export const DEFAULT_PAGE_SIZE = 9;

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page, pageSize, totalItems, totalPages };
}

export function parsePage(value: string | null): number | null {
  if (value === null || value === '') return 1;
  if (!/^\d+$/.test(value)) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? page : null;
}

export function pageCanonical(path: string, page: number, site: URL): string {
  const url = new URL(path, site);
  if (page > 1) url.searchParams.set('page', String(page));
  return url.toString();
}
