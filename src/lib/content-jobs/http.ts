import { errorResponse, json, readJsonBody } from '@/lib/admin/http';
import { RequestValidationError } from '@/lib/content-jobs/validation';
import {
  NotionApiError,
  NotionConfigurationError,
  NotionTimeoutError,
  UnsupportedNotionBlockError,
} from '@/lib/notion';

export async function readJson(request: Request): Promise<unknown> {
  return readJsonBody(request);
}

/**
 * Upstream Notion failures are actionable, so they are reported instead of being
 * collapsed into the generic server error. The hint names the setting to check;
 * no secret value is ever echoed back.
 */
const NOTION_STATUS_HINTS: Record<number, string> = {
  400: 'Notion 拒絕了這個請求，請確認 data source 的欄位結構。',
  401: '請確認 NOTION_TOKEN 有效且未被撤銷。',
  403: '請確認 integration 具備讀取內容權限。',
  404: '請確認 NOTION_DATA_SOURCE_ID 是 Data Source ID，且該資料庫已分享給這個 connection。',
  429: 'Notion 速率限制，請稍後再試。',
};

function notionApiResponse(error: NotionApiError): Response {
  const hint = NOTION_STATUS_HINTS[error.status];
  const code = error.code ? `（${error.code}）` : '';
  return json(
    {
      message: `Notion API 回應 ${error.status}${code}：${error.message}${hint ? ` ${hint}` : ''}`,
    },
    { status: error.status === 429 ? 429 : 502 },
  );
}

export function contentJobErrorResponse(error: unknown): Response {
  if (error instanceof RequestValidationError) {
    return json({ message: error.message }, { status: error.status });
  }
  if (error instanceof NotionConfigurationError) {
    return json({ message: error.message }, { status: 503 });
  }
  if (error instanceof NotionApiError) return notionApiResponse(error);
  if (error instanceof NotionTimeoutError) {
    return json(
      { message: `Notion 請求逾時（${error.timeoutMs}ms），請稍後再試。` },
      { status: 504 },
    );
  }
  if (error instanceof UnsupportedNotionBlockError) {
    return json(
      {
        message: `Notion 頁面含有轉換器不支援的 block「${error.blockType}」，請先在 Notion 移除或改寫後再同步。`,
      },
      { status: 422 },
    );
  }
  return errorResponse(error);
}
