import { defineMiddleware } from 'astro:middleware';

const adminJsonLimit = 1024 * 1024;
const adminUploadLimit = 6 * 1024 * 1024;

function applySecurityHeaders(headers: Headers, isAdminRoute: boolean, isHttps: boolean) {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set(
    'Content-Security-Policy',
    "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
  );
  if (isHttps) headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (isAdminRoute || import.meta.env.PUBLIC_PREVIEW === 'true') {
    headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const isAdminRoute =
    context.url.pathname.startsWith('/admin') || context.url.pathname.startsWith('/api/admin');
  const isAdminApi = context.url.pathname.startsWith('/api/admin');
  const methodMayHaveBody = !['GET', 'HEAD', 'OPTIONS'].includes(context.request.method);
  if (isAdminApi && methodMayHaveBody) {
    const contentLength = context.request.headers.get('content-length');
    if (contentLength !== null) {
      const declaredBytes = Number(contentLength);
      const maxBytes =
        context.url.pathname === '/api/admin/upload' ? adminUploadLimit : adminJsonLimit;
      if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 0 || declaredBytes > maxBytes) {
        const headers = new Headers({
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'private, no-store',
        });
        applySecurityHeaders(headers, true, context.url.protocol === 'https:');
        return new Response(JSON.stringify({ message: 'Request body is too large.' }), {
          status: declaredBytes > maxBytes ? 413 : 400,
          headers,
        });
      }
    }
  }
  const response = await next();
  const headers = new Headers(response.headers);
  applySecurityHeaders(headers, isAdminRoute, context.url.protocol === 'https:');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});
