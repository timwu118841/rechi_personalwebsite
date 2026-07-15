import { createHash, timingSafeEqual } from 'node:crypto';
import { getCronSecret } from './content/env';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
} as const;

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

export function isAuthorizedCronRequest(request: Request, secret = getCronSecret()): boolean {
  const expected = secret ? `Bearer ${secret}` : '';
  const provided = request.headers.get('authorization') ?? '';
  const equal = timingSafeEqual(digest(provided), digest(expected));
  return expected.length > 0 && provided.length === expected.length && equal;
}

export function hasCronSecret(secret = getCronSecret()): boolean {
  return secret.length > 0;
}

export function privateResponse(body: BodyInit | null, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(PRIVATE_HEADERS)) headers.set(name, value);
  return new Response(body, { ...init, headers });
}

export function unauthorizedCronResponse(): Response {
  return privateResponse('Unauthorized', { status: 401 });
}

export function missingCronSecretResponse(): Response {
  return privateResponse('Worker authorization is not configured.', { status: 503 });
}
