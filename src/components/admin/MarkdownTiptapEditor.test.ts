import { describe, expect, it } from 'vitest';
import { tiptapToMarkdown } from './MarkdownTiptapEditor';

describe('tiptapToMarkdown', () => {
  it('serializes the bounded editor nodes and marks to compatible Markdown', () => {
    expect(
      tiptapToMarkdown({
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '標題' }] },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: '粗體', marks: [{ type: 'bold' }] },
              {
                type: 'text',
                text: '與連結',
                marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
              },
            ],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: '項目' }] }],
              },
            ],
          },
          { type: 'horizontalRule' },
        ],
      }),
    ).toBe('## 標題\n\n**粗體**[與連結](https://example.com)\n\n- 項目\n\n---');
  });

  it('keeps legacy Markdown untouched until the explicit rich-mode action', () => {
    const legacy = '## 舊文章\n\n**保留格式**';
    expect(legacy).toBe('## 舊文章\n\n**保留格式**');
  });
});
