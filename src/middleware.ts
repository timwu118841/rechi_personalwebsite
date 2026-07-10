import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const isKeystaticRoute = context.url.pathname.startsWith('/keystatic');
  const hasCloudAdmin = Boolean(import.meta.env.PUBLIC_KEYSTATIC_CLOUD_PROJECT?.trim());

  if (isKeystaticRoute && import.meta.env.PROD && !hasCloudAdmin) {
    return new Response('正式環境尚未設定受保護的內容管理服務。', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  const response = await next();
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isKeystaticRoute || import.meta.env.PUBLIC_PREVIEW === 'true') {
    headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});
