import { describe, expect, it, vi } from 'vitest';
import {
  NOTION_API_VERSION,
  NotionClient,
  NotionTimeoutError,
  classifyNotionRetry,
  type NotionBlock,
} from './index';

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function list(results: unknown[], nextCursor: string | null = null) {
  return { object: 'list', results, has_more: nextCursor !== null, next_cursor: nextCursor };
}

describe('NotionClient', () => {
  it('pins the API version and reads source bodies through the Markdown API', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init: init ?? {} });
      if (url.endsWith('/pages/page-1')) {
        return json({
          object: 'page',
          id: 'page-1',
          in_trash: true,
          properties: {
            Name: { id: 'title', type: 'title', title: [{ type: 'text', plain_text: '文章' }] },
            Related: { id: 'rel', type: 'relation', relation: [{ id: 'r1' }], has_more: true },
          },
        });
      }
      if (url.includes('/properties/rel?') && url.includes('start_cursor=prop-2')) {
        return json(list([{ object: 'property_item', type: 'relation', relation: { id: 'r3' } }]));
      }
      if (url.includes('/properties/rel?')) {
        return json(
          list([{ object: 'property_item', type: 'relation', relation: { id: 'r2' } }], 'prop-2'),
        );
      }
      if (url.endsWith('/pages/page-1/markdown')) {
        return json({
          object: 'page_markdown',
          id: 'page-1',
          markdown: '## 文章正文\n\n來自 Notion Markdown API。',
          truncated: false,
          unknown_block_ids: [],
        });
      }
      if (url.includes('/data_sources/source/query')) {
        const body = JSON.parse(String(init?.body)) as { start_cursor?: string };
        return json(
          body.start_cursor
            ? list([{ object: 'page', id: 'p2', properties: {} }])
            : list([{ object: 'page', id: 'p1', properties: {} }], 'source-2'),
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    const client = new NotionClient({ token: 'secret', fetch: fetchMock as typeof fetch });

    const snapshot = await client.readSourceSnapshot('page-1');
    const pages = await client.queryDataSource('source');

    expect(snapshot.sourceState).toBe('archived');
    expect(snapshot.properties.values.Related).toEqual(['r2', 'r3']);
    expect(snapshot.document).toMatchObject({
      version: 2,
      markdown: '## 文章正文\n\n來自 Notion Markdown API。',
    });
    expect(pages.map((page) => page.id)).toEqual(['p1', 'p2']);
    expect(calls.some((call) => call.url.endsWith('/pages/page-1/markdown'))).toBe(true);
    expect(calls.some((call) => call.url.includes('/blocks/page-1/children'))).toBe(false);
    expect(
      calls.every(
        (call) => new Headers(call.init.headers).get('Notion-Version') === NOTION_API_VERSION,
      ),
    ).toBe(true);
  });

  it('fails closed rather than storing an incomplete truncated Markdown body', async () => {
    const client = new NotionClient({
      token: 'secret',
      fetch: vi.fn(async (input) =>
        String(input).endsWith('/markdown')
          ? json({
              object: 'page_markdown',
              id: 'large-page',
              markdown: '部分內容\n\n<unknown url="https://notion.so/block" alt="paragraph"/>',
              truncated: true,
              unknown_block_ids: ['missing-block'],
            })
          : json({ object: 'page', id: 'large-page', properties: {} }),
      ) as unknown as typeof fetch,
    });

    await expect(client.readSourceSnapshot('large-page')).rejects.toThrow(/truncated/i);
  });

  it('uses Retry-After for 429 and retries 529', async () => {
    const sleep = vi.fn(async () => undefined);
    const responses = [
      json({ message: 'slow down' }, 429, { 'Retry-After': '2' }),
      json({ message: 'overloaded' }, 529),
      json(list([])),
    ];
    const client = new NotionClient({
      token: 'secret',
      fetch: vi.fn(async () => responses.shift()!) as unknown as typeof fetch,
      sleep,
      random: () => 0,
    });

    await expect(client.retrieveBlockChildren('page')).resolves.toEqual([]);
    expect(sleep).toHaveBeenNthCalledWith(1, 2_000);
    expect(sleep).toHaveBeenNthCalledWith(2, 500);
    expect(classifyNotionRetry({ status: 403, attempt: 0 }).retry).toBe(false);
  });

  it('fails closed on a legacy archived marker without changing the pinned contract', async () => {
    const client = new NotionClient({
      token: 'secret',
      fetch: vi.fn(async (input) =>
        String(input).endsWith('/markdown')
          ? json({
              object: 'page_markdown',
              id: 'legacy',
              markdown: '正文',
              truncated: false,
              unknown_block_ids: [],
            })
          : json({ object: 'page', id: 'legacy', archived: true, properties: {} }),
      ) as unknown as typeof fetch,
    });

    await expect(client.readSourceSnapshot('legacy')).resolves.toMatchObject({
      sourceState: 'archived',
    });
  });

  it('aborts timed-out requests and exposes a timeout error when retries are exhausted', async () => {
    const fetchMock = vi.fn(
      (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    const client = new NotionClient({
      token: 'secret',
      fetch: fetchMock as unknown as typeof fetch,
      timeoutMs: 5,
      maxRetries: 0,
    });

    await expect(client.retrieveBlockChildren('page')).rejects.toBeInstanceOf(NotionTimeoutError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

// Compile-time fixture guard for the recursive block shape used by consumers.
const _blockShape: NotionBlock = { object: 'block', id: 'x', type: 'divider', divider: {} };
void _blockShape;
