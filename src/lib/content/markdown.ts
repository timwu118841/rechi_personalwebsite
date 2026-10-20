import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import {
  appearanceDataAttrs,
  normalizeTextAppearanceAttrs,
  normalizeTextMarks,
} from './text-appearance';

marked.setOptions({ async: false, gfm: true, breaks: true });

/**
 * Notion's Markdown API returns "enhanced markdown": standard Markdown plus
 * HTML-like tags for blocks plain Markdown cannot express (callouts, toggles,
 * mentions, equations). Sanitising those tags away silently flattened the
 * Notion layout, so they are mapped onto safe, styled elements here.
 */
// sanitize-html calls transform callbacks as (tagName, attribs).
type TagTransform = (
  tagName: string,
  attribs: Record<string, string>,
) => {
  tagName: string;
  attribs: Record<string, string>;
};

function mentionElement(
  _tagName: string,
  attribs: Record<string, string>,
): {
  tagName: string;
  attribs: Record<string, string>;
} {
  return attribs.url
    ? { tagName: 'a', attribs: { href: attribs.url, class: 'mention' } }
    : { tagName: 'span', attribs: { class: 'mention' } };
}

const notionTagTransforms: Record<string, TagTransform> = {
  callout: (_tagName, attribs) => ({
    tagName: 'div',
    attribs: { class: 'callout', 'data-icon': attribs.icon || '' },
  }),
  'mention-page': mentionElement,
  'mention-user': mentionElement,
  'mention-date': () => ({ tagName: 'span', attribs: { class: 'mention' } }),
  'mention-database': mentionElement,
  equation: () => ({ tagName: 'span', attribs: { class: 'equation' } }),
};

/**
 * Notion's enhanced markdown uses two constructs that plain CommonMark cannot
 * parse:
 *
 * - `<empty-block/>` marks an empty paragraph. Marked treats a document that
 *   starts with a block-level HTML tag as one raw HTML block, and Notion
 *   separates blocks with single newlines (no blank line to close the block),
 *   so the whole article came out as unparsed markdown text.
 * - `<span color="…">…</span>` wraps coloured text. Markdown inside raw inline
 *   HTML is not parsed, so `**bold**` inside the span stayed literal.
 *
 * Both are normalised before parsing, which also repairs already stored
 * articles without a re-sync.
 */
const NOTION_COLOR_SPAN = /<span\s+color="([a-z0-9_]+)"\s*>([\s\S]*?)<\/span>/gi;

function prepareNotionMarkdown(markdown: string): string {
  return markdown
    .replace(/<empty-block\s*\/?>(?:\s*<\/empty-block>)?/gi, '\n\n')
    .replace(NOTION_COLOR_SPAN, (_match, color: string, inner: string) => {
      const rendered = marked.parseInline(inner) as string;
      return `<span data-notion-color="${color}">${rendered}</span>`;
    });
}

type RichNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: RichNode[];
  marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>;
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] || character,
  );
}

function richNodeHtml(node: RichNode, parentType?: string): string {
  if (node.type === 'text') {
    let value = escapeHtml(node.text || '');
    const marks = normalizeTextMarks(node.marks);
    const appearance = marks?.find((mark) => mark.type === 'textAppearance')?.attrs;
    const dataAttrs = appearanceDataAttrs(appearance);
    if (Object.keys(dataAttrs).length) {
      const attrs = Object.entries(dataAttrs)
        .map(([name, attrValue]) => `${name}="${escapeHtml(attrValue)}"`)
        .join(' ');
      value = `<span ${attrs}>${value}</span>`;
    }
    for (const mark of marks || []) {
      if (mark.type === 'bold') value = `<strong>${value}</strong>`;
      if (mark.type === 'italic') value = `<em>${value}</em>`;
      if (mark.type === 'strike') value = `<del>${value}</del>`;
      if (mark.type === 'underline') value = `<u>${value}</u>`;
      if (mark.type === 'code') value = `<code>${value}</code>`;
      if (mark.type === 'link' && typeof mark.attrs?.href === 'string') {
        value = `<a href="${escapeHtml(mark.attrs.href)}">${value}</a>`;
      }
    }
    return value;
  }
  if (node.type === 'hardBreak') return '<br />';
  if (node.type === 'listItem' && parentType !== 'bulletList' && parentType !== 'orderedList') {
    return '';
  }
  const attrs = node.attrs || {};
  const children = (node.content || [])
    .filter(
      (child) =>
        (node.type !== 'bulletList' && node.type !== 'orderedList') || child.type === 'listItem',
    )
    .map((child) => richNodeHtml(child, node.type))
    .join('');
  if (node.type === 'image' && typeof attrs.src === 'string') {
    return `<img src="${escapeHtml(attrs.src)}" alt="${escapeHtml(String(attrs.alt || ''))}" />`;
  }
  if (node.type === 'horizontalRule') return '<hr />';
  if (node.type === 'codeBlock') return `<pre><code>${children}</code></pre>`;
  if (node.type === 'blockquote') return `<blockquote>${children}</blockquote>`;
  if (node.type === 'bulletList') return `<ul>${children}</ul>`;
  if (node.type === 'orderedList') return `<ol>${children}</ol>`;
  if (node.type === 'listItem') return `<li>${children}</li>`;
  if (node.type === 'heading') {
    const level = Math.min(3, Math.max(1, Number(attrs.level) || 2));
    return `<h${level}>${children}</h${level}>`;
  }
  if (node.type === 'paragraph') return `<p>${children}</p>`;
  // A document is a container for block nodes; wrapping all children in a
  // paragraph would create invalid nested markup such as <p><h2>…</h2></p>.
  if (node.type === 'doc') return children;
  return children;
}

const richHtmlOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'em',
    'u',
    'del',
    'blockquote',
    'ul',
    'ol',
    'li',
    'h2',
    'h3',
    'h4',
    'pre',
    'code',
    'a',
    'hr',
    'img',
    'h1',
    'span',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    code: ['class'],
    span: ['data-editor-size', 'data-editor-color'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: (_tagName: string, attribs: Record<string, string>) => ({
      tagName: 'a',
      attribs: {
        ...attribs,
        ...(attribs.href?.startsWith('http') ? { rel: 'noopener noreferrer' } : {}),
      },
    }),
    img: (_tagName: string, attribs: Record<string, string>) => ({
      tagName: 'img',
      attribs: { ...attribs, loading: 'lazy' },
    }),
    span: (_tagName: string, attribs: Record<string, string>) => {
      const canonical = normalizeTextAppearanceAttrs({
        size: attribs['data-editor-size'],
        color: attribs['data-editor-color'],
      });
      return { tagName: 'span', attribs: appearanceDataAttrs(canonical) };
    },
  },
};

/** Render a bounded Tiptap JSON document and sanitize the result server-side. */
export function renderRichText(document: unknown): string {
  if (!document || typeof document !== 'object') return '';
  return sanitizeHtml(richNodeHtml(document as RichNode), richHtmlOptions);
}

export function renderMarkdown(markdown: string): string {
  const rendered = marked.parse(prepareNotionMarkdown(markdown)) as string;
  return sanitizeHtml(rendered, {
    allowedTags: [
      'p',
      'br',
      'strong',
      'em',
      'del',
      'blockquote',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'pre',
      'code',
      'a',
      'hr',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'img',
      'div',
      'details',
      'summary',
      'figure',
      'figcaption',
      'span',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'rel', 'class'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      code: ['class'],
      div: ['class', 'data-icon'],
      details: ['open'],
      span: ['class', 'data-notion-color'],
      // Needed so the callout icon survives until the transform runs.
      callout: ['icon'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: {
          ...attribs,
          ...(attribs.href?.startsWith('http') ? { rel: 'noopener noreferrer' } : {}),
        },
      }),
      img: (_tagName, attribs) => ({
        tagName: 'img',
        attribs: { ...attribs, loading: 'lazy' },
      }),
      ...notionTagTransforms,
    },
  });
}

export function markdownToPlainText(markdown: string): string {
  return sanitizeHtml(renderMarkdown(markdown), { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
}
