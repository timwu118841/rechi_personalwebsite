import { describe, expect, it } from 'vitest';
import { convertNotionBlocks, renderNotionMarkdown } from './converter';
import { UnsupportedNotionBlockError } from './errors';
import { computeNotionHashes } from './hash';
import { mapPageProperties } from './properties';
import type { NotionBlock, NotionProperty } from './types';

const text = (plainText: string, extra: Record<string, unknown> = {}) => ({
  type: 'text',
  plain_text: plainText,
  annotations: {},
  ...extra,
});

describe('Notion conversion and canonical hashes', () => {
  it('converts nested allowlisted blocks, inline marks, links, and media refs', () => {
    const document = convertNotionBlocks([
      {
        object: 'block',
        id: 'heading',
        type: 'heading_2',
        heading_2: { rich_text: [text('標題', { annotations: { bold: true } })] },
      },
      {
        object: 'block',
        id: 'list',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: [text('外層')] },
        children: [
          {
            object: 'block',
            id: 'nested',
            type: 'paragraph',
            paragraph: {
              rich_text: [text('內層', { href: 'https://example.com/legal' })],
            },
          },
        ],
      },
      {
        object: 'block',
        id: 'image',
        type: 'image',
        image: {
          type: 'file',
          file: { url: 'https://signed.example/first?token=temporary' },
          caption: [text('圖片說明')],
        },
      },
    ] as NotionBlock[]);

    expect(document.searchText).toBe('標題 外層 內層 圖片說明');
    expect(document.blocks[1]?.children?.[0]?.content?.[0]?.marks).toEqual([
      { type: 'link', href: 'https://example.com/legal' },
    ]);
    expect(document.mediaSourceRefs).toEqual([
      {
        blockId: 'image',
        kind: 'notion_file',
        canonicalRef: 'notion-file:image',
        fetchUrl: 'https://signed.example/first?token=temporary',
        caption: '圖片說明',
      },
    ]);
    expect(document.blocks[2]?.mediaRef).toBe('asset://notion/image');
  });

  it('keeps source and render hashes stable when a temporary signed URL rotates', () => {
    const properties = mapPageProperties({
      Name: { id: 'title', type: 'title', title: [text('文章')] } as NotionProperty,
    });
    const makeDocument = (url: string) =>
      convertNotionBlocks([
        {
          object: 'block',
          id: 'same-image',
          type: 'image',
          image: { type: 'file', file: { url }, caption: [] },
        } as NotionBlock,
      ]);

    expect(
      computeNotionHashes({ properties, document: makeDocument('https://a.test/one') }),
    ).toEqual(computeNotionHashes({ properties, document: makeDocument('https://a.test/two') }));
  });

  it('includes promoted media bytes in the render freshness hash only', () => {
    const properties = mapPageProperties({
      Name: { id: 'title', type: 'title', title: [text('文章')] } as NotionProperty,
    });
    const document = convertNotionBlocks([
      {
        object: 'block',
        id: 'same-image',
        type: 'image',
        image: { type: 'file', file: { url: 'https://a.test/image' }, caption: [] },
      } as NotionBlock,
    ]);
    const first = computeNotionHashes({ properties, document, stagedMediaDigests: ['bytes-a'] });
    const second = computeNotionHashes({ properties, document, stagedMediaDigests: ['bytes-b'] });

    expect(first.sourceHash).toBe(second.sourceHash);
    expect(first.renderHash).not.toBe(second.renderHash);
  });

  it('fails closed on unsupported blocks', () => {
    expect(() =>
      convertNotionBlocks([
        { object: 'block', id: 'table-1', type: 'table', table: {} } as NotionBlock,
      ]),
    ).toThrow(UnsupportedNotionBlockError);
  });

  it('rejects externally hosted image blocks', () => {
    expect(() =>
      convertNotionBlocks([
        {
          object: 'block',
          id: 'external-image',
          type: 'image',
          image: { type: 'external', external: { url: 'https://images.example.com/photo.png' } },
        } as NotionBlock,
      ]),
    ).toThrow(UnsupportedNotionBlockError);
  });

  it('renders image blocks with replaceable logical asset references instead of source URLs', () => {
    const document = convertNotionBlocks([
      {
        object: 'block',
        id: 'cover-image',
        type: 'image',
        image: {
          type: 'file',
          file: { url: 'https://signed.example/image.png?token=secret' },
          caption: [text('封面')],
        },
      },
    ] as NotionBlock[]);

    expect(renderNotionMarkdown(document)).toBe('![封面](asset://notion/cover-image)');
  });

  it('maps article properties and preserves normalized property values', () => {
    const mapped = mapPageProperties({
      Name: { id: 'a', type: 'title', title: [text('判決筆記')] } as NotionProperty,
      Description: {
        id: 'b',
        type: 'rich_text',
        rich_text: [text('摘要')],
      } as NotionProperty,
      Tags: {
        id: 'c',
        type: 'multi_select',
        multi_select: [{ name: '民法' }, { name: '契約' }],
      } as NotionProperty,
      Slug: { id: 'd', type: 'rich_text', rich_text: [text('civil-note')] } as NotionProperty,
      Featured: { id: 'e', type: 'checkbox', checkbox: true } as NotionProperty,
    });

    expect(mapped).toMatchObject({
      title: '判決筆記',
      description: '摘要',
      tags: ['民法', '契約'],
      slug: 'civil-note',
      values: { Featured: true },
    });
  });
});
