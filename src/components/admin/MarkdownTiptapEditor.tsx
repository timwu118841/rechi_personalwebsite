import { useEditor, EditorContent, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import { useRef, useState } from 'react';
import type { MediaAsset } from '@/lib/content/types';

type Props = {
  value: string;
  bodyJson?: unknown;
  onChange: (value: string) => void;
  onDocumentChange?: (document: JSONContent) => void;
  onUpload?: (file: File, alt: string) => Promise<MediaAsset>;
};

export function isTiptapDocument(value: unknown): value is JSONContent {
  if (!value || typeof value !== 'object') return false;
  const document = value as { type?: unknown; content?: unknown };
  return document.type === 'doc' && Array.isArray(document.content);
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ||
      character,
  );
}

function textWithMarks(node: JSONContent): string {
  let value = node.type === 'hardBreak' ? '\n' : node.text || '';
  for (const mark of [...(node.marks || [])].reverse()) {
    if (mark.type === 'bold') value = `**${value}**`;
    if (mark.type === 'italic') value = `*${value}*`;
    if (mark.type === 'strike') value = `~~${value}~~`;
    if (mark.type === 'code') value = `\`${value}\``;
    if (mark.type === 'link' && mark.attrs?.href) value = `[${value}](${mark.attrs.href})`;
  }
  return value;
}

function serializeNode(node: JSONContent, depth = 0): string {
  const children = node.content || [];
  if (node.type === 'text' || node.type === 'hardBreak') return textWithMarks(node);
  if (node.type === 'image') return `![${node.attrs?.alt || ''}](${node.attrs?.src || ''})`;
  if (node.type === 'horizontalRule') return '---';
  if (node.type === 'codeBlock') return `\`\`\`\n${children.map(serializeNode).join('')}\n\`\`\``;
  if (node.type === 'heading')
    return `${'#'.repeat(Math.min(3, Number(node.attrs?.level) || 1))} ${children.map(serializeNode).join('')}`;
  if (node.type === 'blockquote')
    return children.map((child) => `> ${serializeNode(child, depth)}`).join('\n');
  if (node.type === 'bulletList')
    return children.map((child) => `- ${serializeNode(child, depth + 1)}`).join('\n');
  if (node.type === 'orderedList')
    return children
      .map((child, index) => `${index + 1}. ${serializeNode(child, depth + 1)}`)
      .join('\n');
  if (node.type === 'listItem')
    return children.map((child) => serializeNode(child, depth)).join('\n');
  return children
    .map((child) => serializeNode(child, depth))
    .join(node.type === 'paragraph' ? '' : '\n\n');
}

export function tiptapToMarkdown(document: JSONContent) {
  return (document.content || [])
    .map((node) => serializeNode(node))
    .join('\n\n')
    .trim();
}

export default function MarkdownTiptapEditor({
  value,
  bodyJson,
  onChange,
  onDocumentChange,
  onUpload,
}: Props) {
  const richDocument = isTiptapDocument(bodyJson) ? bodyJson : undefined;
  const [richMode, setRichMode] = useState(Boolean(richDocument) || !value);
  const [linkUrl, setLinkUrl] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, protocols: ['http', 'https', 'mailto'] }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: richDocument || (value ? `<p>${escapeHtml(value)}</p>` : '<p></p>'),
    onUpdate: ({ editor: nextEditor }) => {
      const document = nextEditor.getJSON();
      onChange(tiptapToMarkdown(document));
      onDocumentChange?.(document);
    },
  });

  if (!richMode) {
    return (
      <div className="markdown-editor-fallback">
        <textarea
          className="article-body-input"
          rows={24}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
        />
        <p className="markdown-help">
          現有 Markdown 文章維持 Markdown 模式，不會在未確認時轉換格式。
        </p>
        <button type="button" className="secondary" onClick={() => setRichMode(true)}>
          啟用視覺編輯器（會以純文字開始）
        </button>
      </div>
    );
  }
  if (!editor) return <div className="tiptap-editor-loading">正在載入編輯器…</div>;
  const toggle = (name: string) => editor.chain().focus()[name as 'toggleBold']().run();
  return (
    <div className="tiptap-editor">
      <div className="tiptap-toolbar" aria-label="文章格式工具列">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </button>
        <button type="button" onClick={() => toggle('toggleBold')} aria-label="粗體">
          <strong>B</strong>
        </button>
        <button type="button" onClick={() => toggle('toggleItalic')} aria-label="斜體">
          <em>I</em>
        </button>
        <button type="button" onClick={() => toggle('toggleStrike')} aria-label="刪除線">
          <s>S</s>
        </button>
        <button type="button" onClick={() => toggle('toggleUnderline')} aria-label="底線">
          <u>U</u>
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}>
          • 清單
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1. 清單
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          引用
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          {'{ }'} 程式碼
        </button>
        <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          分隔線
        </button>
        <button
          type="button"
          onClick={() => {
            const url = window.prompt('連結網址', linkUrl);
            if (url) {
              setLinkUrl(url);
              editor.chain().focus().setLink({ href: url }).run();
            }
          }}
        >
          連結
        </button>
        {onUpload && (
          <>
            <button type="button" onClick={() => fileInput.current?.click()}>
              圖片
            </button>
            <input
              ref={fileInput}
              hidden
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const alt = window.prompt('圖片替代文字', file.name);
                if (!alt) return;
                const asset = await onUpload(file, alt);
                editor
                  .chain()
                  .focus()
                  .setImage({
                    src: asset.url,
                    alt: asset.alt,
                    width: asset.width,
                    height: asset.height,
                  })
                  .run();
                event.target.value = '';
              }}
            />
          </>
        )}
        <button type="button" onClick={() => editor.chain().focus().undo().run()}>
          復原
        </button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()}>
          重做
        </button>
      </div>
      <EditorContent editor={editor} />
      <button type="button" className="secondary" onClick={() => setRichMode(false)}>
        回到 Markdown 模式
      </button>
    </div>
  );
}
