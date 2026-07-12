import { describe, expect, it } from 'vitest';
import {
  isTiptapDocument,
  normalizeTiptapDocument,
  tiptapToMarkdown,
} from './MarkdownTiptapEditor';

describe('isTiptapDocument', () => {
  it('accepts a persisted Tiptap document', () => {
    expect(isTiptapDocument({ type: 'doc', content: [] })).toBe(true);
  });

  it('rejects malformed persisted JSON so the editor can remain in Markdown mode', () => {
    expect(isTiptapDocument({ type: 'paragraph', content: [] })).toBe(false);
    expect(isTiptapDocument({ type: 'doc', content: 'invalid' })).toBe(false);
    expect(isTiptapDocument(null)).toBe(false);
  });
});

describe('tiptapToMarkdown', () => {
  it('serializes a blank document as an empty body without a stray list marker', () => {
    expect(tiptapToMarkdown({ type: 'doc', content: [] })).toBe('');
    expect(tiptapToMarkdown({ type: 'doc', content: [{ type: 'paragraph', content: [] }] })).toBe(
      '',
    );
  });

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

  it('serializes rich content used by the additive body_json migration', () => {
    expect(
      tiptapToMarkdown({
        type: 'doc',
        content: [
          { type: 'codeBlock', content: [{ type: 'text', text: 'const answer = 42;' }] },
          { type: 'image', attrs: { src: '/uploads/answer.png', alt: '答案圖' } },
        ],
      }),
    ).toBe('```\nconst answer = 42;\n```\n\n![答案圖](/uploads/answer.png)');
  });

  it('does not serialize an empty ordered list as a stray list marker', () => {
    expect(
      tiptapToMarkdown({
        type: 'doc',
        content: [
          {
            type: 'orderedList',
            content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [] }] }],
          },
        ],
      }),
    ).toBe('');
  });

  it('preserves hard breaks created by Shift+Enter', () => {
    expect(
      tiptapToMarkdown({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: '第一行' },
              { type: 'hardBreak' },
              { type: 'text', text: '第二行' },
            ],
          },
        ],
      }),
    ).toBe('第一行\n第二行');
  });
});

describe('normalizeTiptapDocument', () => {
  it('drops unsupported nodes and marks while preserving supported descendants', () => {
    expect(
      normalizeTiptapDocument({
        type: 'doc',
        content: [
          {
            type: 'customWidget',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '保留' }] }],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: '格式', marks: [{ type: 'highlight' }, { type: 'bold' }] },
            ],
          },
        ],
      }),
    ).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '保留' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '格式', marks: [{ type: 'bold' }] }] },
      ],
    });
  });

  it('turns empty list artifacts into blank paragraphs', () => {
    expect(
      normalizeTiptapDocument({
        type: 'doc',
        content: [
          {
            type: 'orderedList',
            content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [] }] }],
          },
        ],
      }),
    ).toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [] }] });
  });

  it('omits null text appearance dimensions and ignores malformed list children', () => {
    expect(
      normalizeTiptapDocument({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: '大小',
                marks: [{ type: 'textAppearance', attrs: { size: 'large', color: null } }],
              },
              {
                type: 'text',
                text: '顏色',
                marks: [{ type: 'textAppearance', attrs: { size: null, color: 'accent' } }],
              },
            ],
          },
          {
            type: 'bulletList',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: '錯誤子節點' }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [] }] },
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: '有效' }] }],
              },
            ],
          },
        ],
      }),
    ).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '大小',
              marks: [{ type: 'textAppearance', attrs: { size: 'large' } }],
            },
            {
              type: 'text',
              text: '顏色',
              marks: [{ type: 'textAppearance', attrs: { color: 'accent' } }],
            },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: '有效' }] }],
            },
          ],
        },
      ],
    });
  });
});
