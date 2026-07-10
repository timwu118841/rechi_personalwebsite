import { describe, expect, it } from 'vitest';
import { markdownToPlainText, renderMarkdown } from './markdown';

describe('safe Markdown rendering', () => {
  it('renders normal long-form markup', () => {
    const html = renderMarkdown('## 標題\n\n**重要內容**與[連結](https://example.com)');
    expect(html).toContain('<h2>標題</h2>');
    expect(html).toContain('<strong>重要內容</strong>');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('removes scripts and event handlers', () => {
    const html = renderMarkdown(
      '<script>alert(1)</script><img src="https://example.com/a.jpg" alt="圖" onerror="alert(1)">',
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
  });

  it('creates plain search text without markup', () => {
    expect(markdownToPlainText('**法律** `工作`')).toBe('法律 工作');
  });
});
