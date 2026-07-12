import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import {
  appearanceDataAttrs,
  normalizeTextAppearanceAttrs,
  normalizeTextMarks,
} from './text-appearance';

marked.setOptions({ async: false, gfm: true, breaks: false });

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
  const rendered = marked.parse(markdown) as string;
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
      'h2',
      'h3',
      'h4',
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
    ],
    allowedAttributes: {
      a: ['href', 'title', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      code: ['class'],
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
    },
  });
}

export function markdownToPlainText(markdown: string): string {
  return sanitizeHtml(renderMarkdown(markdown), { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
}
