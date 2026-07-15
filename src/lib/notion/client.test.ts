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
  it('pins the API version and recursively paginates page properties, data sources, and nested blocks', async () => {
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
      if (url.endsWith('/pages/child-1')) {
        return json({
          object: 'page',
          id: 'child-1',
          last_edited_time: '2026-07-15T00:00:01.000Z',
          properties: {},
        });
      }
      if (url.endsWith('/pages/child-2')) {
        return json({
          object: 'page',
          id: 'child-2',
          last_edited_time: '2026-07-15T00:00:02.000Z',
          properties: {},
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
      if (url.includes('/blocks/page-1/children') && url.includes('start_cursor=blocks-2')) {
        return json(
          list([
            {
              object: 'block',
              id: 'parent',
              type: 'quote',
              has_children: true,
              quote: { rich_text: [{ type: 'text', plain_text: '父層' }] },
            },
          ]),
        );
      }
      if (url.includes('/blocks/root/children') && url.includes('start_cursor=root-2')) {
        return json(
          list([
            {
              object: 'block',
              id: 'child-2',
              type: 'child_page',
              child_page: { title: '第二篇' },
            },
          ]),
        );
      }
      if (url.includes('/blocks/root/children')) {
        return json(
          list(
            [
              { object: 'block', id: 'paragraph', type: 'paragraph', paragraph: {} },
              {
                object: 'block',
                id: 'child-1',
                type: 'child_page',
                child_page: { title: '第一篇' },
                has_children: true,
              },
            ],
            'root-2',
          ),
        );
      }
      if (url.includes('/blocks/page-1/children')) {
        return json(list([], 'blocks-2'));
      }
      if (url.includes('/blocks/parent/children')) {
        return json(
          list([
            {
              object: 'block',
              id: 'child',
              type: 'paragraph',
              paragraph: { rich_text: [{ type: 'text', plain_text: '子層' }] },
            },
          ]),
        );
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
    const childPages = await client.listChildPages('root');

    expect(snapshot.sourceState).toBe('archived');
    expect(snapshot.properties.values.Related).toEqual(['r2', 'r3']);
    expect(snapshot.document.blocks[0]?.children?.[0]?.blockId).toBe('child');
    expect(pages.map((page) => page.id)).toEqual(['p1', 'p2']);
    expect(childPages).toEqual([
      { id: 'child-1', title: '第一篇', lastEditedTime: '2026-07-15T00:00:01.000Z' },
      { id: 'child-2', title: '第二篇', lastEditedTime: '2026-07-15T00:00:02.000Z' },
    ]);
    expect(calls.some((call) => call.url.includes('/blocks/child-1/children'))).toBe(false);
    expect(
      calls.every(
        (call) => new Headers(call.init.headers).get('Notion-Version') === NOTION_API_VERSION,
      ),
    ).toBe(true);
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

  it('fails open with an unknown edit time when a canonical child page lookup fails', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/blocks/root/children')) {
        return json(
          list([
            { object: 'block', id: 'child-1', type: 'child_page', child_page: { title: '文章' } },
          ]),
        );
      }
      return json({ message: 'temporary failure' }, 500);
    });
    const client = new NotionClient({
      token: 'secret',
      fetch: fetchMock as typeof fetch,
      maxRetries: 0,
    });

    await expect(client.listChildPages('root')).resolves.toEqual([
      { id: 'child-1', title: '文章', lastEditedTime: null },
    ]);
  });

  it('fails closed on a legacy archived marker without changing the pinned contract', async () => {
    const client = new NotionClient({
      token: 'secret',
      fetch: vi.fn(async (input) =>
        String(input).includes('/pages/')
          ? json({ object: 'page', id: 'legacy', archived: true, properties: {} })
          : json(list([])),
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
