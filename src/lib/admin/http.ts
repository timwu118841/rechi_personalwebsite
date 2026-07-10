import type { APIContext } from 'astro';
import { validationError } from '@/lib/content/validation';

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'private, no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function errorResponse(error: unknown) {
  if (error instanceof Response) {
    const headers = new Headers(error.headers);
    headers.set('Cache-Control', 'private, no-store');
    headers.set('X-Robots-Tag', 'noindex, nofollow');
    return new Response(error.body, {
      status: error.status,
      statusText: error.statusText,
      headers,
    });
  }
  if (error && typeof error === 'object' && 'issues' in error) {
    return json(
      { message: '請修正表單欄位。', fields: validationError(error as never) },
      { status: 400 },
    );
  }
  const value = error as { code?: string; message?: string };
  if (value?.code === '23505') {
    return json({ message: '網址代稱已被使用，請更換後再儲存。' }, { status: 409 });
  }
  console.error(error);
  return json({ message: value?.message || '伺服器暫時無法完成操作。' }, { status: 500 });
}

export async function invalidateContent(context: APIContext, extraTags: string[] = []) {
  if (!context.cache.enabled) return;
  await context.cache.invalidate({ tags: ['content', ...extraTags] });
}
