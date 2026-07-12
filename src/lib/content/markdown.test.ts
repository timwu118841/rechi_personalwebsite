import { describe, expect, it } from 'vitest';
import { markdownToPlainText, renderMarkdown, renderRichText } from './markdown';

describe('safe Markdown rendering', () => {
  it('renders a blank canonical rich document without an ordered-list marker', () => {
    const html = renderRichText({
      type: 'doc',
      content: [{ type: 'paragraph', content: [] }],
    });

    expect(html).toBe('<p></p>');
    expect(html).not.toContain('1.');
    expect(html).not.toContain('<ol');
  });

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
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '主標題' }] },
        ],
      }),
    ).toBe('<h1>主標題</h1>');
  });

  it('renders only canonical bounded appearance tokens', () => {
    expect(
      renderRichText({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: '安全',
                marks: [{ type: 'textAppearance', attrs: { size: 'large', color: 'accent' } }],
              },
            ],
          },
        ],
      }),
    ).toBe('<p><span data-editor-size="large" data-editor-color="accent">安全</span></p>');
  });

  it('merges duplicate appearance marks with valid dimensions', () => {
    expect(
      renderRichText({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: '合併',
                marks: [
                  { type: 'textAppearance', attrs: { size: 'small' } },
                  { type: 'textAppearance', attrs: { color: 'accent' } },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe('<p><span data-editor-size="small" data-editor-color="accent">合併</span></p>');
  });

  it('renders rich list items with semantic list-item wrappers', () => {
    expect(
      renderRichText({
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: '項目' }] }],
              },
            ],
          },
        ],
      }),
    ).toBe('<ul><li><p>項目</p></li></ul>');
  });

  it('rejects malformed non-list children inside lists', () => {
    const html = renderRichText({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: '不應直接出現在清單中' }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [] }] },
          ],
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '孤立項目' }] }],
        },
      ],
    });

    expect(html).toBe('<ul><li><p></p></li></ul>');
    expect(html).not.toContain('<ul><p>');
    expect(html).not.toContain('孤立項目');
  });

  it('drops invalid appearance values and arbitrary attributes without dropping text', () => {
    const html = renderRichText({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '保留',
              marks: [
                {
                  type: 'textAppearance',
                  attrs: { size: 'huge', color: 'red', style: 'color:red', class: 'evil' },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(html).toBe('<p>保留</p>');
    expect(html).not.toContain('style');
    expect(html).not.toContain('class');
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
