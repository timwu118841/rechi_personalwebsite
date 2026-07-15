import { describe, expect, it, vi } from 'vitest';
import {
  MAX_NOTION_IMAGE_BYTES,
  downloadNotionImage,
  resolveNotionAssetUrls,
  validatedMediaUrl,
} from './media';
import type { MediaSourceRef } from './types';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const media: MediaSourceRef = {
  blockId: 'image-1',
  kind: 'notion_file',
  canonicalRef: 'notion-file:image-1',
  fetchUrl: 'https://s3.us-west-2.amazonaws.com/secure.notion-static.com/image.png?token=temporary',
  caption: '圖說',
};

describe('Notion media safety', () => {
  it('accepts a Notion-hosted HTTPS image URL', () => {
    expect(validatedMediaUrl(media.fetchUrl).hostname).toBe('s3.us-west-2.amazonaws.com');
  });

  it.each([
    'http://s3.us-west-2.amazonaws.com/secure.notion-static.com/image.png',
    'https://user:password@s3.us-west-2.amazonaws.com/secure.notion-static.com/image.png',
    'https://cdn.example.com/image.png',
    'https://s3.us-west-2.amazonaws.com/other-bucket/image.png',
    'https://s3.us-west-2.amazonaws.com/secure.notion-static.com.evil/image.png',
  ])('rejects unsafe image URL %s', (url) => {
    expect(() => validatedMediaUrl(url)).toThrow();
  });

  it('rejects externally hosted image blocks before downloading them', () => {
    expect(() => validatedMediaUrl('https://images.example.com/legal-note.png')).toThrow(
      /uploaded to the Notion workspace/,
    );
  });

  it('returns validated MIME and byte size for a downloaded image', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(png, {
          headers: { 'Content-Type': 'image/png', 'Content-Length': String(png.length) },
        }),
    );

    await expect(downloadNotionImage(media, fetchMock as typeof fetch)).resolves.toMatchObject({
      mimeType: 'image/png',
      byteSize: png.length,
      extension: 'png',
    });
  });

  it('accepts a chunked image response without Content-Length and limits the actual stream', async () => {
    const fetchMock = vi.fn(
      async () => new Response(png, { headers: { 'Content-Type': 'image/png' } }),
    );

    await expect(downloadNotionImage(media, fetchMock as typeof fetch)).resolves.toMatchObject({
      mimeType: 'image/png',
      byteSize: png.length,
    });
  });

  it('rejects a chunked response when the actual stream exceeds the byte limit', async () => {
    const oversized = new Uint8Array(MAX_NOTION_IMAGE_BYTES + 1);
    oversized.set(png);
    const fetchMock = vi.fn(
      async () => new Response(oversized, { headers: { 'Content-Type': 'image/png' } }),
    );

    await expect(downloadNotionImage(media, fetchMock as typeof fetch)).rejects.toThrow(
      /between 1 byte/,
    );
  });

  it('rejects an unsupported response MIME type', async () => {
    const fetchMock = vi.fn(
      async () => new Response(png, { headers: { 'Content-Type': 'image/gif' } }),
    );

    await expect(downloadNotionImage(media, fetchMock as typeof fetch)).rejects.toThrow(
      /not supported/,
    );
  });

  it('rejects a response whose declared MIME does not match its bytes', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(png, {
          headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(png.length) },
        }),
    );

    await expect(downloadNotionImage(media, fetchMock as typeof fetch)).rejects.toThrow(
      /does not match/,
    );
  });

  it('rejects an image whose declared size exceeds the download limit', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(png, {
          headers: {
            'Content-Type': 'image/png',
            'Content-Length': String(MAX_NOTION_IMAGE_BYTES + 1),
          },
        }),
    );

    await expect(downloadNotionImage(media, fetchMock as typeof fetch)).rejects.toThrow(
      /between 1 byte/,
    );
  });

  it('reports a non-successful image download status', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 502 }));

    await expect(downloadNotionImage(media, fetchMock as typeof fetch)).rejects.toThrow(/502/);
  });

  it('propagates a network download error', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('network unavailable');
    });

    await expect(downloadNotionImage(media, fetchMock as typeof fetch)).rejects.toThrow(
      /network unavailable/,
    );
  });

  it('replaces every matching logical asset reference', () => {
    const markdown = ['![first](asset://notion/block-1)', '![second](asset://notion/block-1)'].join(
      '\n',
    );

    expect(
      resolveNotionAssetUrls(markdown, new Map([['block-1', 'https://cdn.example.com/a.png']])),
    ).toBe(
      ['![first](https://cdn.example.com/a.png)', '![second](https://cdn.example.com/a.png)'].join(
        '\n',
      ),
    );
  });

  it('fails when any logical asset reference remains unresolved', () => {
    expect(() => resolveNotionAssetUrls('![](asset://notion/missing)', new Map())).toThrow(
      /unresolved/,
    );
  });
});
