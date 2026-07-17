import './server-only';
import { convertNotionBlocks } from './converter';
import { NotionApiError, NotionTimeoutError } from './errors';
import { mapPageProperties } from './properties';
import {
  NOTION_API_VERSION,
  type NotionBlock,
  type NotionChildPage,
  type NotionListResponse,
  type NotionObject,
  type NotionPage,
  type NotionProperty,
  type NotionSourceSnapshot,
} from './types';

const DEFAULT_BASE_URL = 'https://api.notion.com/v1';

export interface NotionClientOptions {
  token: string;
  fetch?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
}

export interface RetryDecision {
  retry: boolean;
  delayMs: number;
  reason: 'rate_limited' | 'server_error' | 'timeout' | 'not_retryable';
}

export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(900_000, Math.ceil(seconds * 1000));
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.min(900_000, Math.max(0, date - now));
}

export function classifyNotionRetry(input: {
  status?: number;
  timeout?: boolean;
  retryAfter?: string | null;
  attempt: number;
  random?: () => number;
}): RetryDecision {
  const random = input.random ?? Math.random;
  const fallback = Math.min(15_000, 250 * 2 ** input.attempt) + Math.floor(random() * 100);
  if (input.timeout) return { retry: true, delayMs: fallback, reason: 'timeout' };
  if (input.status === 429) {
    return {
      retry: true,
      delayMs: parseRetryAfter(input.retryAfter ?? null) ?? fallback,
      reason: 'rate_limited',
    };
  }
  if (input.status !== undefined && input.status >= 500 && input.status <= 599) {
    return { retry: true, delayMs: fallback, reason: 'server_error' };
  }
  return { retry: false, delayMs: 0, reason: 'not_retryable' };
}

function isListResponse<T>(value: unknown): value is NotionListResponse<T> {
  const candidate = value as Partial<NotionListResponse<T>> | null;
  return Boolean(candidate && candidate.object === 'list' && Array.isArray(candidate.results));
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function mergePropertyItems(property: NotionProperty, items: NotionObject[]): NotionProperty {
  const values = items
    .map((item) => item[property.type])
    .flatMap((value) => {
      if (Array.isArray(value)) return value;
      return value === undefined ? [] : [value];
    });
  return { ...property, [property.type]: values, has_more: false };
}

export class NotionClient {
  private readonly fetchImplementation: typeof fetch;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly random: () => number;

  constructor(private readonly options: NotionClientOptions) {
    this.fetchImplementation = options.fetch ?? globalThis.fetch;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.maxRetries = options.maxRetries ?? 8;
    this.sleep =
      options.sleep ??
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.random = options.random ?? Math.random;
  }

  private async fetchOnce(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    try {
      return await this.fetchImplementation(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.options.token}`,
          'Notion-Version': NOTION_API_VERSION,
          'Content-Type': 'application/json',
          ...init.headers,
        },
      });
    } catch (error) {
      if (timedOut || (error instanceof DOMException && error.name === 'AbortError')) {
        throw new NotionTimeoutError(this.timeoutMs);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetchOnce(path, init);
      } catch (error) {
        if (!(error instanceof NotionTimeoutError) || attempt >= this.maxRetries) throw error;
        const decision = classifyNotionRetry({ timeout: true, attempt, random: this.random });
        await this.sleep(decision.delayMs);
        continue;
      }

      if (response.ok) return (await response.json()) as T;

      const decision = classifyNotionRetry({
        status: response.status,
        retryAfter: response.headers.get('Retry-After'),
        attempt,
        random: this.random,
      });
      if (decision.retry && attempt < this.maxRetries) {
        await this.sleep(decision.delayMs);
        continue;
      }

      const body = object(await response.json().catch(() => null));
      throw new NotionApiError(
        typeof body?.message === 'string'
          ? body.message
          : `Notion request failed with ${response.status}`,
        response.status,
        typeof body?.code === 'string' ? body.code : undefined,
      );
    }
  }

  private async paginate<T extends NotionObject>(
    requestPage: (cursor: string | null) => Promise<NotionListResponse<T>>,
  ): Promise<T[]> {
    const results: T[] = [];
    let cursor: string | null = null;
    do {
      const page = await requestPage(cursor);
      if (!isListResponse<T>(page)) throw new Error('Invalid paginated Notion response');
      results.push(...page.results);
      cursor = page.has_more ? page.next_cursor : null;
      if (page.has_more && !cursor)
        throw new Error('Notion pagination response omitted next_cursor');
    } while (cursor);
    return results;
  }

  async retrievePage(pageId: string): Promise<NotionPage> {
    return this.request<NotionPage>(`/pages/${encodeURIComponent(pageId)}`);
  }

  async retrievePageProperty(pageId: string, propertyId: string): Promise<NotionObject[]> {
    return this.paginate<NotionObject>((cursor) => {
      const query = new URLSearchParams({ page_size: '100' });
      if (cursor) query.set('start_cursor', cursor);
      return this.request<NotionListResponse<NotionObject>>(
        `/pages/${encodeURIComponent(pageId)}/properties/${encodeURIComponent(propertyId)}?${query}`,
      );
    });
  }

  async retrievePageWithProperties(pageId: string): Promise<NotionPage> {
    const page = await this.retrievePage(pageId);
    const properties = await Promise.all(
      Object.entries(page.properties).map(async ([name, property]) => {
        if (property.has_more !== true) return [name, property] as const;
        const items = await this.retrievePageProperty(page.id, property.id);
        return [name, mergePropertyItems(property, items)] as const;
      }),
    );
    return { ...page, properties: Object.fromEntries(properties) };
  }

  async queryDataSource(
    dataSourceId: string,
    body: Record<string, unknown> = {},
  ): Promise<NotionPage[]> {
    return this.paginate<NotionPage>((cursor) =>
      this.request<NotionListResponse<NotionPage>>(
        `/data_sources/${encodeURIComponent(dataSourceId)}/query`,
        {
          method: 'POST',
          body: JSON.stringify({
            ...body,
            page_size: 100,
            ...(cursor ? { start_cursor: cursor } : {}),
          }),
        },
      ),
    );
  }

  async retrieveBlockChildren(blockId: string): Promise<NotionBlock[]> {
    const blocks = await this.paginate<NotionBlock>((cursor) => {
      const query = new URLSearchParams({ page_size: '100' });
      if (cursor) query.set('start_cursor', cursor);
      return this.request<NotionListResponse<NotionBlock>>(
        `/blocks/${encodeURIComponent(blockId)}/children?${query}`,
      );
    });
    return Promise.all(
      blocks.map(async (block) =>
        block.has_children
          ? { ...block, children: await this.retrieveBlockChildren(block.id) }
          : block,
      ),
    );
  }

  /** List only direct child pages; descendants are synced as their own sources. */
  async listChildPages(rootPageId: string): Promise<NotionChildPage[]> {
    const blocks = await this.paginate<NotionBlock>((cursor) => {
      const query = new URLSearchParams({ page_size: '100' });
      if (cursor) query.set('start_cursor', cursor);
      return this.request<NotionListResponse<NotionBlock>>(
        `/blocks/${encodeURIComponent(rootPageId)}/children?${query}`,
      );
    });
    const childPages = blocks.flatMap((block) => {
      if (block.type !== 'child_page') return [];
      const childPage = object(block.child_page);
      return [{ id: block.id, title: typeof childPage?.title === 'string' ? childPage.title : '' }];
    });
    return Promise.all(
      childPages.map(async (childPage) => {
        try {
          const page = await this.retrievePage(childPage.id);
          return { ...childPage, lastEditedTime: page.last_edited_time ?? null };
        } catch {
          // Root discovery must remain useful when one child page's metadata
          // is temporarily unavailable; null makes root sync fail open.
          return { ...childPage, lastEditedTime: null };
        }
      }),
    );
  }

  async readSourceSnapshot(pageId: string): Promise<NotionSourceSnapshot> {
    const [page, blocks] = await Promise.all([
      this.retrievePageWithProperties(pageId),
      this.retrieveBlockChildren(pageId),
    ]);
    return {
      pageId: page.id,
      // `in_trash` is the pinned 2026-03-11 contract. Treating a legacy
      // archived marker as archived too is deliberately fail-closed and never
      // promotes that marker to the publication state machine.
      sourceState: page.in_trash === true || page['archived'] === true ? 'archived' : 'active',
      lastEditedTime: page.last_edited_time ?? null,
      url: page.url ?? null,
      properties: mapPageProperties(page.properties),
      document: convertNotionBlocks(blocks),
    };
  }
}
