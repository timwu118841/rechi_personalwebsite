import { describe, expect, it } from 'vitest';
import { contentJobErrorResponse } from '@/lib/content-jobs/http';
import {
  NotionApiError,
  NotionConfigurationError,
  NotionTimeoutError,
  UnsupportedNotionBlockError,
} from '@/lib/notion';

describe('content job error responses', () => {
  it('reports a Notion data source lookup failure instead of a generic server error', async () => {
    const response = contentJobErrorResponse(
      new NotionApiError('Could not find data source with ID: 0000.', 404, 'object_not_found'),
    );

    expect(response.status).toBe(502);
    const { message } = await response.json();
    expect(message).toContain('404');
    expect(message).toContain('object_not_found');
    expect(message).toContain('Could not find data source with ID: 0000.');
    expect(message).toContain('NOTION_DATA_SOURCE_ID');
  });

  it('keeps Notion rate limiting distinguishable from other upstream failures', async () => {
    const response = contentJobErrorResponse(
      new NotionApiError('rate limited', 429, 'rate_limited'),
    );

    expect(response.status).toBe(429);
  });

  it('names the missing environment variables when editorial sync is not configured', async () => {
    const response = contentJobErrorResponse(
      new NotionConfigurationError(['NOTION_EDITORIAL_ENABLED=true', 'NOTION_TOKEN']),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      message: 'Notion 整合尚未設定，缺少：NOTION_EDITORIAL_ENABLED=true、NOTION_TOKEN。',
    });
  });

  it('reports unsupported Notion blocks with the offending block type', async () => {
    const response = contentJobErrorResponse(new UnsupportedNotionBlockError('table', 'block-1'));

    expect(response.status).toBe(422);
    const { message } = await response.json();
    expect(message).toContain('table');
  });

  it('reports Notion timeouts as a gateway timeout', async () => {
    const response = contentJobErrorResponse(new NotionTimeoutError(10_000));

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({
      message: 'Notion 請求逾時（10000ms），請稍後再試。',
    });
  });

  it('still hides unexpected server error details', async () => {
    const response = contentJobErrorResponse(
      new Error('password authentication failed for internal_db'),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ message: '伺服器暫時無法完成操作。' });
  });
});
