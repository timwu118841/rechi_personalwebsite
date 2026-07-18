import type { APIContext } from 'astro';
import { validationError } from '@/lib/content/validation';

export const DEFAULT_MAX_JSON_BODY_BYTES = 1024 * 1024;

export class HttpRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpRequestError';
  }
}

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
  if (error instanceof HttpRequestError) {
    return json({ message: error.message }, { status: error.status });
  }
  const value = error as {
    code?: string;
    message?: string;
    field?: string;
    constraint?: string;
    detail?: string;
    details?: string;
  };
  if (value?.code === '409') {
    return json({ message: value.message || '資料已變更，請重新載入後再試。' }, { status: 409 });
  }
  if (value?.code === '23505') {
    const message = '網址代稱已被使用，請更換後再儲存。';
    if (value.field) {
      return json({ message, fields: { [value.field]: message } }, { status: 409 });
    }
    if (
      value.constraint?.includes('slug') ||
      value.detail?.includes('slug') ||
      value.detail?.includes('old_slug') ||
      value.details?.includes('slug') ||
      value.details?.includes('old_slug')
    ) {
      return json({ message, fields: { slug: message } }, { status: 409 });
    }
    return json({ message }, { status: 409 });
  }
  console.error(error);
  return json({ message: '伺服器暫時無法完成操作。' }, { status: 500 });
}

export async function readJsonBody(
  request: Request,
  maxBytes = DEFAULT_MAX_JSON_BODY_BYTES,
): Promise<unknown> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new HttpRequestError(415, 'Content-Type must be application/json.');
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    const declaredBytes = Number(contentLength);
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 0) {
      throw new HttpRequestError(400, 'Content-Length is invalid.');
    }
    if (declaredBytes > maxBytes) {
      throw new HttpRequestError(413, 'Request body is too large.');
    }
  }

  if (!request.body) throw new HttpRequestError(400, 'Request body must contain valid JSON.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new HttpRequestError(413, 'Request body is too large.');
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
  } catch {
    throw new HttpRequestError(400, 'Request body must contain valid JSON.');
  }
}

export async function invalidateContent(context: APIContext, extraTags: string[] = []) {
  if (!context.cache.enabled) return;
  await context.cache.invalidate({ tags: ['content', ...extraTags] });
}
