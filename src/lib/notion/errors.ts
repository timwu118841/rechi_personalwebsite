export class NotionApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'NotionApiError';
  }
}

export class NotionConfigurationError extends Error {
  constructor(readonly missing: string[]) {
    super(
      missing.length
        ? `Notion 整合尚未設定，缺少：${missing.join('、')}。`
        : 'Notion 整合尚未設定。',
    );
    this.name = 'NotionConfigurationError';
  }
}

export class NotionTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Notion request timed out after ${timeoutMs}ms`);
    this.name = 'NotionTimeoutError';
  }
}

export class UnsupportedNotionBlockError extends Error {
  constructor(
    readonly blockType: string,
    readonly blockId: string,
  ) {
    super(`Unsupported Notion block type "${blockType}" at block ${blockId}`);
    this.name = 'UnsupportedNotionBlockError';
  }
}
