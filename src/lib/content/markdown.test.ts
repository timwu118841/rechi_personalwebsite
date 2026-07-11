import { describe, expect, it } from 'vitest';
import { markdownToPlainText, renderMarkdown, renderRichText } from './markdown';

describe('safe Markdown rendering', () => {
  it('renders rich document blocks without an invalid paragraph wrapper', () => {
    const html = renderRichText({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '標題' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '內容' }] },
      ],
    });
    expect(html).toBe('<h2>標題</h2><p>內容</p>');
    expect(html).not.toContain('<p><h');
  });

  it('preserves supported level-one headings from the editor', () => {
    expect(
      renderRichText({
        type: 'doc',
        content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '主標題' }] }],
      }),
    ).toBe('<h1>主標題</h1>');
  });

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
