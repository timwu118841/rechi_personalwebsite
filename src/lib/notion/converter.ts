import './server-only';
import { createHash } from 'node:crypto';
import { UnsupportedNotionBlockError } from './errors';
import { validatedMediaUrl } from './media';
import type {
  ConvertedNotionDocument,
  MediaSourceRef,
  NormalizedBlock,
  NormalizedMark,
  NormalizedText,
  NotionBlock,
  NotionRichText,
} from './types';

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading_1',
  'heading_2',
  'heading_3',
  'bulleted_list_item',
  'numbered_list_item',
  'quote',
  'code',
  'divider',
  'image',
]);

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function safeLink(value: unknown, block: NotionBlock): string | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) {
      throw new UnsupportedNotionBlockError('unsafe_link', block.id);
    }
    return value;
  } catch (error) {
    if (error instanceof UnsupportedNotionBlockError) throw error;
    throw new UnsupportedNotionBlockError('invalid_link', block.id);
  }
}

function convertRichText(value: unknown, block: NotionBlock): NormalizedText[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const rich = entry as NotionRichText;
    if (rich.type !== 'text' || typeof rich.plain_text !== 'string') {
      throw new UnsupportedNotionBlockError(`rich_text_${String(rich.type)}`, block.id);
    }
    const annotations = rich.annotations ?? {};
    const marks: NormalizedMark[] = [];
    if (annotations.bold) marks.push({ type: 'bold' });
    if (annotations.italic) marks.push({ type: 'italic' });
    if (annotations.underline) marks.push({ type: 'underline' });
    if (annotations.strikethrough) marks.push({ type: 'strike' });
    if (annotations.code) marks.push({ type: 'code' });
    const href = safeLink(rich.href ?? rich.text?.link?.url, block);
    if (href) marks.push({ type: 'link', href });
    return {
      type: 'text',
      text: rich.plain_text,
      ...(marks.length ? { marks } : {}),
    };
  });
}

function plainText(content: NormalizedText[] | undefined): string {
  return (content ?? []).map((item) => item.text).join('');
}

function blockBody(block: NotionBlock): Record<string, unknown> {
  return object(block[block.type]) ?? {};
}

function convertBlock(block: NotionBlock, media: MediaSourceRef[]): NormalizedBlock {
  if (!BLOCK_TYPES.has(block.type)) {
    throw new UnsupportedNotionBlockError(block.type, block.id);
  }

  const body = blockBody(block);
  const children = block.children?.map((child) => convertBlock(child, media));
  const withChildren = children?.length ? { children } : {};

  if (block.type === 'divider') {
    return { type: 'divider', blockId: block.id, ...withChildren };
  }

  if (block.type === 'image') {
    const imageType = body.type;
    if (imageType !== 'file') {
      throw new UnsupportedNotionBlockError(`image_${String(imageType)}`, block.id);
    }
    const source = object(body.file);
    const fetchUrl = source?.url;
    if (typeof fetchUrl !== 'string') {
      throw new UnsupportedNotionBlockError('image_missing_url', block.id);
    }
    const caption = convertRichText(body.caption, block);
    media.push({
      blockId: block.id,
      kind: 'notion_file',
      canonicalRef: `notion-file:${block.id}`,
      fetchUrl,
      caption: plainText(caption),
    });
    return {
      type: 'image',
      blockId: block.id,
      mediaRef: `asset://notion/${block.id}`,
      ...(caption.length ? { caption } : {}),
      ...withChildren,
    };
  }

  const content = convertRichText(body.rich_text, block);
  if (block.type.startsWith('heading_')) {
    return {
      type: 'heading',
      blockId: block.id,
      level: Number(block.type.slice(-1)) as 1 | 2 | 3,
      content,
      ...withChildren,
    };
  }
  if (block.type === 'bulleted_list_item') {
    return { type: 'bulletListItem', blockId: block.id, content, ...withChildren };
  }
  if (block.type === 'numbered_list_item') {
    return { type: 'numberedListItem', blockId: block.id, content, ...withChildren };
  }
  if (block.type === 'quote') {
    return { type: 'quote', blockId: block.id, content, ...withChildren };
  }
  if (block.type === 'code') {
    return {
      type: 'code',
      blockId: block.id,
      content,
      ...(typeof body.language === 'string' ? { language: body.language } : {}),
      ...withChildren,
    };
  }
  return { type: 'paragraph', blockId: block.id, content, ...withChildren };
}

function collectSearchText(blocks: NormalizedBlock[]): string {
  const parts: string[] = [];
  const visit = (block: NormalizedBlock): void => {
    const text = plainText(block.content ?? block.caption);
    if (text) parts.push(text);
    block.children?.forEach(visit);
  };
  blocks.forEach(visit);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function markdownText(content: NormalizedText[] | undefined): string {
  return (content ?? [])
    .map((item) => {
      let text = item.text.replace(/([\\`*_{}()#+.!|>~-])/g, '\\$1');
      for (const mark of item.marks ?? []) {
        if (mark.type === 'link') text = `[${text}](${mark.href})`;
        if (mark.type === 'bold') text = `**${text}**`;
        if (mark.type === 'italic') text = `*${text}*`;
        if (mark.type === 'strike') text = `~~${text}~~`;
        if (mark.type === 'code') text = `\`${text}\``;
      }
      return text;
    })
    .join('');
}

function markdownBlock(block: NormalizedBlock, depth: number): string {
  const indent = '  '.repeat(Math.max(0, depth));
  const content = markdownText(block.content);
  const children = (block.children ?? [])
    .map((child) => markdownBlock(child, depth + 1))
    .join('\n');
  switch (block.type) {
    case 'heading':
      return `${'#'.repeat(block.level ?? 1)} ${content}${children ? `\n${children}` : ''}`;
    case 'bulletListItem':
      return `${indent}- ${content}${children ? `\n${children}` : ''}`;
    case 'numberedListItem':
      return `${indent}1. ${content}${children ? `\n${children}` : ''}`;
    case 'quote':
      return `> ${content}${children ? `\n${children}` : ''}`;
    case 'code':
      return `\`\`\`${block.language ?? ''}\n${content}\n\`\`\``;
    case 'divider':
      return '---';
    case 'image':
      return `![${markdownText(block.caption)}](${block.mediaRef ?? ''})`;
    default:
      return `${content}${children ? `\n${children}` : ''}`;
  }
}

/** Convert a complete Notion block tree. Any non-allowlisted content aborts the revision. */
export function convertNotionBlocks(blocks: NotionBlock[]): ConvertedNotionDocument {
  const mediaSourceRefs: MediaSourceRef[] = [];
  const normalized = blocks.map((block) => convertBlock(block, mediaSourceRefs));
  return {
    version: 1,
    blocks: normalized,
    searchText: collectSearchText(normalized),
    mediaSourceRefs,
  };
}

function markdownSearchText(markdown: string): string {
  return markdown
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_#>~|{}()-]/g, ' ')
    .replaceAll('[', ' ')
    .replaceAll(']', ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize Notion-flavoured Markdown while retaining Markdown as the source of
 * truth. Signed image URLs are replaced with stable logical refs so published
 * content does not depend on expiring Notion URLs.
 */
export function convertNotionMarkdown(source: string): ConvertedNotionDocument {
  const normalized = source.replace(/\r\n?/g, '\n').trim();
  if (/<unknown\b/i.test(normalized)) {
    throw new UnsupportedNotionBlockError('unknown_markdown', 'markdown-response');
  }

  const mediaByCanonicalRef = new Map<string, MediaSourceRef>();
  const markdown = normalized.replace(
    /!\[([^\]]*)\]\(\s*(https:\/\/[^\s)]+)(?:\s+["'][^"']*["'])?\s*\)/g,
    (_match, caption: string, fetchUrl: string) => {
      const url = validatedMediaUrl(fetchUrl);
      url.search = '';
      url.hash = '';
      const canonicalUrl = url.toString();
      const canonicalRef = `notion-file:${canonicalUrl}`;
      let media = mediaByCanonicalRef.get(canonicalRef);
      if (!media) {
        const stableId = createHash('sha256').update(canonicalUrl).digest('hex').slice(0, 24);
        media = {
          blockId: `markdown-image-${stableId}`,
          kind: 'notion_file',
          canonicalRef,
          fetchUrl,
          caption,
        };
        mediaByCanonicalRef.set(canonicalRef, media);
      }
      return `![${caption}](asset://notion/${media.blockId})`;
    },
  );

  return {
    version: 2,
    blocks: [],
    markdown,
    searchText: markdownSearchText(markdown),
    mediaSourceRefs: [...mediaByCanonicalRef.values()],
  };
}

/** Render the normalized document using only logical asset references. */
export function renderNotionMarkdown(document: ConvertedNotionDocument): string {
  if (document.version === 2 && typeof document.markdown === 'string') {
    return document.markdown.trim();
  }
  return document.blocks
    .map((block) => markdownBlock(block, 0))
    .join('\n\n')
    .trim();
}
