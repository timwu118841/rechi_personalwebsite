import './server-only';
import { createHash } from 'node:crypto';
import type { MediaSourceRef } from './types';

export const MAX_NOTION_IMAGE_BYTES = 5 * 1024 * 1024;
export const NOTION_IMAGE_MIME_EXTENSIONS = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/avif', 'avif'],
]);

const NOTION_FILE_HOST = 's3.us-west-2.amazonaws.com';
const NOTION_FILE_PATH_PREFIX = '/secure.notion-static.com/';

function parseHttpsUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Notion image URL is invalid.');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Notion images must use an unauthenticated HTTPS URL.');
  }
  return url;
}

export interface DownloadedNotionImage {
  bytes: Uint8Array;
  mimeType: string;
  extension: string;
  byteSize: number;
  digest: string;
}

export function validatedMediaUrl(value: string): URL {
  const url = parseHttpsUrl(value);
  if (
    url.hostname.toLowerCase() !== NOTION_FILE_HOST ||
    !url.pathname.startsWith(NOTION_FILE_PATH_PREFIX)
  ) {
    throw new Error('Notion images must be uploaded to the Notion workspace.');
  }
  return url;
}

export function validatedPublicMediaUrl(value: string): URL {
  return parseHttpsUrl(value);
}

export function detectImageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp') {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
  }
  return null;
}

async function readLimitedBody(response: Response, maxBytes: number): Promise<Uint8Array> {
  const contentLength = response.headers.get('Content-Length');
  if (contentLength !== null) {
    const declaredSize = Number(contentLength);
    if (
      !Number.isFinite(declaredSize) ||
      !Number.isInteger(declaredSize) ||
      declaredSize <= 0 ||
      declaredSize > maxBytes
    ) {
      throw new Error(`Notion image must be between 1 byte and ${maxBytes} bytes.`);
    }
  }
  if (!response.body) throw new Error('Notion image response did not include a body.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error(`Notion image must be between 1 byte and ${maxBytes} bytes.`);
    }
    chunks.push(value);
  }
  if (!size) throw new Error('Notion image is empty.');
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function downloadNotionImage(
  media: MediaSourceRef,
  fetchImplementation: typeof fetch = globalThis.fetch,
): Promise<DownloadedNotionImage> {
  const url = validatedMediaUrl(media.fetchUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  const requestInit: RequestInit = {
    method: 'GET',
    redirect: 'error',
    signal: controller.signal,
    headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg' },
  };
  let response: Response;
  try {
    response = await fetchImplementation(url, requestInit);
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new Error(`Notion image download failed with ${response.status}.`);
  const headerMime = (response.headers.get('Content-Type') || '')
    .split(';', 1)[0]!
    .trim()
    .toLowerCase();
  if (!NOTION_IMAGE_MIME_EXTENSIONS.has(headerMime)) {
    throw new Error('Notion image MIME type is not supported.');
  }
  const bytes = await readLimitedBody(response, MAX_NOTION_IMAGE_BYTES);
  const detectedMime = detectImageMime(bytes);
  if (detectedMime !== headerMime)
    throw new Error('Notion image MIME type does not match its bytes.');
  return {
    bytes,
    mimeType: headerMime,
    extension: NOTION_IMAGE_MIME_EXTENSIONS.get(headerMime)!,
    byteSize: bytes.byteLength,
    digest: createHash('sha256').update(bytes).digest('hex'),
  };
}

export function resolveNotionAssetUrls(
  markdown: string,
  urlsByBlockId: Map<string, string>,
): string {
  let resolved = markdown;
  for (const [blockId, publicUrl] of urlsByBlockId) {
    validatedPublicMediaUrl(publicUrl);
    resolved = resolved.split(`asset://notion/${blockId}`).join(publicUrl);
  }
  if (/asset:\/\/notion\//.test(resolved)) {
    throw new Error('Notion content contains an unresolved media asset.');
  }
  return resolved;
}
