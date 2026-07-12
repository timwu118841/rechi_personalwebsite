import { useEditor, EditorContent, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import { Mark, mergeAttributes } from '@tiptap/core';
import { useEffect, useRef, useState } from 'react';
import type { MediaAsset } from '@/lib/content/types';
import {
  normalizeTextAppearanceAttrs,
  normalizeTextMarks,
  TEXT_APPEARANCE_COLORS,
  TEXT_APPEARANCE_SIZES,
} from '@/lib/content/text-appearance';

type Props = {
  value: string;
  bodyJson?: unknown;
  onChange: (value: string) => void;
  onDocumentChange?: (document: JSONContent) => void;
  onUpload?: (file: File, alt: string) => Promise<MediaAsset>;
};

const slashCommands = [
  {
    label: '標題 1',
    hint: '大標題',
    query: 'h1',
    run: (editor: ReturnType<typeof useEditor>) =>
      editor?.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    label: '標題 2',
    hint: '中標題',
    query: 'h2',
    run: (editor: ReturnType<typeof useEditor>) =>
      editor?.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: '標題 3',
    hint: '小標題',
    query: 'h3',
    run: (editor: ReturnType<typeof useEditor>) =>
      editor?.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    label: '項目清單',
    hint: '建立項目清單',
    query: 'bullet',
    run: (editor: ReturnType<typeof useEditor>) => editor?.chain().focus().toggleBulletList().run(),
  },
  {
    label: '編號清單',
    hint: '建立編號清單',
    query: 'number',
    run: (editor: ReturnType<typeof useEditor>) =>
      editor?.chain().focus().toggleOrderedList().run(),
  },
  {
    label: '引用',
    hint: '突顯一段引文',
    query: 'quote',
    run: (editor: ReturnType<typeof useEditor>) => editor?.chain().focus().toggleBlockquote().run(),
  },
  {
    label: '程式碼',
    hint: '等寬程式碼區塊',
    query: 'code',
    run: (editor: ReturnType<typeof useEditor>) => editor?.chain().focus().toggleCodeBlock().run(),
  },
];

export function isTiptapDocument(value: unknown): value is JSONContent {
  if (!value || typeof value !== 'object') return false;
  const document = value as { type?: unknown; content?: unknown };
  return document.type === 'doc' && Array.isArray(document.content);
}

const supportedNodes = new Set([
  'doc',
  'paragraph',
  'text',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'hardBreak',
  'image',
]);
const supportedMarks = new Set([
  'bold',
  'italic',
  'strike',
  'code',
  'link',
  'underline',
  'textAppearance',
]);

const TextAppearance = Mark.create({
  name: 'textAppearance',
  inclusive: false,
  addAttributes() {
    return {
      size: { default: null },
      color: { default: null },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'span[data-editor-size], span[data-editor-color]',
        getAttrs: (element) =>
          normalizeTextAppearanceAttrs({
            size: (element as HTMLElement).dataset.editorSize,
            color: (element as HTMLElement).dataset.editorColor,
          }) || false,
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const attrs = normalizeTextAppearanceAttrs(HTMLAttributes);
    if (!attrs) return ['span', {}, 0];
    return [
      'span',
      mergeAttributes(
        attrs.size ? { 'data-editor-size': attrs.size } : {},
        attrs.color ? { 'data-editor-color': attrs.color } : {},
      ),
      0,
    ];
  },
});

/**
 * Keep persisted rich content within the node/mark allowlist understood by
 * this editor. Unknown wrappers are flattened instead of being silently
 * passed to Tiptap, and empty list artifacts become plain paragraphs.
 */
export function normalizeTiptapDocument(value: unknown): JSONContent | undefined {
  if (!isTiptapDocument(value)) return undefined;

  const normalizeNode = (input: unknown): JSONContent[] => {
    if (!input || typeof input !== 'object') return [];
    const node = input as JSONContent;
    const children = Array.isArray(node.content) ? node.content.flatMap(normalizeNode) : [];
    if (!supportedNodes.has(String(node.type))) return children;
    if (node.type === 'doc') return children;
    if (node.type === 'text') {
      const marks = normalizeTextMarks(
        (node.marks || []).filter((mark) => supportedMarks.has(String(mark.type))),
      );
      return typeof node.text === 'string' && node.text
        ? [{ type: 'text', text: node.text, ...(marks.length ? { marks } : {}) }]
        : [];
    }
    if (node.type === 'image') {
      const src = typeof node.attrs?.src === 'string' ? node.attrs.src : '';
      return src ? [{ type: 'image', attrs: { ...node.attrs, src } }] : [];
    }
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      const listItems = children.filter((child) => {
        if (child.type !== 'listItem') return true;
        return (child.content || []).some((item) =>
          item.type !== 'paragraph' || Boolean((item.content || []).length),
        );
      });
      if (listItems.length === 0) return [{ type: 'paragraph', content: [] }];
      return [{ type: node.type, ...(node.attrs ? { attrs: node.attrs } : {}), content: listItems }];
    }
    return [{ type: node.type, ...(node.attrs ? { attrs: node.attrs } : {}), ...(children.length ? { content: children } : {}) }];
  };

  return { type: 'doc', content: normalizeNode(value) };
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
    return children
      .map((child) => serializeNode(child, depth + 1))
      .filter(Boolean)
      .map((content) => `- ${content}`)
      .join('\n');
  if (node.type === 'orderedList')
    return children
      .map((child) => serializeNode(child, depth + 1))
      .filter(Boolean)
      .map((content, index) => `${index + 1}. ${content}`)
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
  const richDocument = normalizeTiptapDocument(bodyJson);
  const [richMode, setRichMode] = useState(Boolean(richDocument) || !value);
  const [linkUrl, setLinkUrl] = useState('');
  const [documentStats, setDocumentStats] = useState({ characters: 0, words: 0 });
  const [uploadError, setUploadError] = useState('');
  const [slashMenu, setSlashMenu] = useState<{ query: string; from: number; index: number } | null>(
    null,
  );
  const [selectionToolbar, setSelectionToolbar] = useState<{ top: number; left: number } | null>(
    null,
  );
  const editorShell = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const updateStats = (nextEditor: NonNullable<typeof editor>) => {
    const text = nextEditor.state.doc.textContent;
    setDocumentStats({
      characters: text.length,
      words: text.trim() ? text.trim().split(/\s+/).length : 0,
    });
    nextEditor.view.dom.classList.toggle('is-empty', !text);
  };
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextAppearance,
      Link.configure({ openOnClick: false, protocols: ['http', 'https', 'mailto'] }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: richDocument || (value ? `<p>${escapeHtml(value)}</p>` : '<p></p>'),
    editorProps: {
      attributes: { 'data-placeholder': '輸入內容，或輸入 / 選擇區塊' },
    },
    onCreate: ({ editor: nextEditor }) => {
      updateStats(nextEditor);
    },
    onUpdate: ({ editor: nextEditor }) => {
      const document = nextEditor.getJSON();
      const text = nextEditor.state.doc.textContent;
      updateStats(nextEditor);
      onChange(tiptapToMarkdown(document));
      onDocumentChange?.(document);
      nextEditor.view.dom.classList.toggle('is-empty', !text);
      const { $from } = nextEditor.state.selection;
      const blockText = $from.parent.textContent;
      const match = blockText.match(/^\/([\w-]*)$/);
      if (match) {
        setSlashMenu({ query: match[1].toLowerCase(), from: $from.start(), index: 0 });
      } else {
        setSlashMenu(null);
      }
    },
  });

  // Parent records can change while this component stays mounted. Reconcile
  // only when the incoming document differs from the current editor state, so
  // normal onUpdate parent re-renders never overwrite in-progress edits.
  useEffect(() => {
    if (!editor || !richMode) return;
    const incoming = richDocument || (value ? `<p>${escapeHtml(value)}</p>` : '<p></p>');
    const current = JSON.stringify(editor.getJSON());
    const next = typeof incoming === 'string' ? incoming : JSON.stringify(incoming);
    if (typeof incoming !== 'string' && current === next) return;
    if (typeof incoming === 'string' && tiptapToMarkdown(editor.getJSON()) === value) return;
    editor.commands.setContent(incoming, { emitUpdate: false });
    updateStats(editor);
    setSlashMenu(null);
  }, [editor, richDocument, value, richMode]);

  useEffect(() => {
    if (!editor) return;
    const updateSelectionToolbar = () => {
      if (editor.state.selection.empty || !editorShell.current) {
        setSelectionToolbar(null);
        return;
      }
      const { from, to } = editor.state.selection;
      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);
      const bounds = editorShell.current.getBoundingClientRect();
      setSelectionToolbar({
        top: Math.max(8, Math.min(start.top, end.top) - bounds.top - 44),
        left: Math.max(
          8,
          Math.min(bounds.width - 180, (start.left + end.left) / 2 - bounds.left - 90),
        ),
      });
    };
    editor.on('selectionUpdate', updateSelectionToolbar);
    editor.on('blur', () => window.setTimeout(() => setSelectionToolbar(null), 120));
    return () => {
      editor.off('selectionUpdate', updateSelectionToolbar);
    };
  }, [editor]);

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
  const canUndo = editor.can().chain().focus().undo().run();
  const canRedo = editor.can().chain().focus().redo().run();
  const setAppearance = (attrs: { size?: (typeof TEXT_APPEARANCE_SIZES)[number]; color?: (typeof TEXT_APPEARANCE_COLORS)[number] }) => {
    const normalized = normalizeTextAppearanceAttrs(attrs);
    if (!normalized) return editor.chain().focus().unsetMark('textAppearance').run();
    return editor.chain().focus().setMark('textAppearance', normalized).run();
  };
  const slashMatches = slashCommands.filter(
    (command) =>
      !slashMenu?.query ||
      `${command.query} ${command.label}`.toLowerCase().includes(slashMenu.query),
  );
  const runSlashCommand = (index: number) => {
    if (!slashMenu || !slashMatches[index]) return;
    const command = slashMatches[index];
    editor
      .chain()
      .focus()
      .deleteRange({ from: slashMenu.from, to: editor.state.selection.from })
      .run();
    command.run(editor);
    setSlashMenu(null);
  };
  return (
    <div
      className="tiptap-editor"
      ref={editorShell}
      onKeyDown={(event) => {
        // Handle hard breaks before the slash-command Enter handler. Without
        // this, Shift+Enter is treated as selecting the active command.
        if (event.key === 'Enter' && event.shiftKey) {
          event.preventDefault();
          editor.chain().focus().setHardBreak().run();
          setSlashMenu(null);
          return;
        }
        if (!slashMenu || !slashMatches.length) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          setSlashMenu({
            ...slashMenu,
            index:
              (slashMenu.index + (event.key === 'ArrowDown' ? 1 : slashMatches.length - 1)) %
              slashMatches.length,
          });
        } else if (event.key === 'Enter') {
          event.preventDefault();
          runSlashCommand(slashMenu.index);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          setSlashMenu(null);
        }
      }}
    >
      <div className="tiptap-toolbar" role="toolbar" aria-label="文章格式工具列">
        <div className="tiptap-toolbar-group" role="group" aria-label="標題">
          {[1, 2, 3].map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={editor.isActive('heading', { level })}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .toggleHeading({ level: level as 1 | 2 | 3 })
                  .run()
              }
            >
              H{level}
            </button>
          ))}
        </div>
        <div className="tiptap-toolbar-group" role="group" aria-label="文字格式">
          <button
            type="button"
            onClick={() => toggle('toggleBold')}
            aria-label="粗體"
            aria-pressed={editor.isActive('bold')}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            onClick={() => toggle('toggleItalic')}
            aria-label="斜體"
            aria-pressed={editor.isActive('italic')}
          >
            <em>I</em>
          </button>
          <button
            type="button"
            onClick={() => toggle('toggleStrike')}
            aria-label="刪除線"
            aria-pressed={editor.isActive('strike')}
          >
            <s>S</s>
          </button>
          <button
            type="button"
            onClick={() => toggle('toggleUnderline')}
            aria-label="底線"
            aria-pressed={editor.isActive('underline')}
          >
            <u>U</u>
          </button>
        </div>
        <div className="tiptap-toolbar-group" role="group" aria-label="區塊格式">
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
        </div>
        <div className="tiptap-toolbar-group" role="group" aria-label="插入">
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
                  setUploadError('');
                  try {
                    const asset = await onUpload(file, alt);
                    if (!mounted.current) return;
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
                  } catch (error) {
                    setUploadError(
                      error instanceof Error ? error.message : '圖片上傳失敗，請再試一次。',
                    );
                  } finally {
                    event.target.value = '';
                  }
                }}
              />
            </>
          )}
        </div>
        {uploadError && <p role="alert">{uploadError}</p>}
        <div className="tiptap-toolbar-group" role="group" aria-label="編輯歷程">
          <button
            type="button"
            disabled={!canUndo}
            onClick={() => editor.chain().focus().undo().run()}
          >
            復原
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={() => editor.chain().focus().redo().run()}
          >
            重做
          </button>
        </div>
      </div>
      <div className="tiptap-canvas">
        <EditorContent editor={editor} />
        {slashMenu && slashMatches.length > 0 && (
          <div
            className="tiptap-slash-menu"
            role="listbox"
            aria-label="插入區塊"
            aria-activedescendant={`tiptap-slash-option-${slashMatches[slashMenu.index]?.query || slashMatches[0].query}`}
          >
            <p>插入區塊</p>
            {slashMatches.map((command, index) => (
              <button
                key={command.query}
                type="button"
                role="option"
                aria-selected={index === slashMenu.index}
                id={`tiptap-slash-option-${command.query}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runSlashCommand(index)}
              >
                <strong>{command.label}</strong>
                <small>{command.hint}</small>
              </button>
            ))}
          </div>
        )}
        {selectionToolbar && (
          <div
            className="tiptap-selection-toolbar"
            style={{ top: selectionToolbar.top, left: selectionToolbar.left }}
            role="toolbar"
            aria-label="選取文字格式"
          >
            <button
              type="button"
              aria-label="粗體"
              aria-pressed={editor.isActive('bold')}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              aria-label="斜體"
              aria-pressed={editor.isActive('italic')}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <em>I</em>
            </button>
            <button
              type="button"
              aria-label="刪除線"
              aria-pressed={editor.isActive('strike')}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editor.chain().focus().toggleStrike().run()}
            >
              <s>S</s>
            </button>
            <button
              type="button"
              aria-label="連結"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                const url = window.prompt('連結網址', 'https://');
                if (url) editor.chain().focus().setLink({ href: url }).run();
              }}
            >
              ↗
            </button>
            {TEXT_APPEARANCE_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                aria-label={size === 'small' ? '小字' : '大字'}
                aria-pressed={editor.isActive('textAppearance', { size })}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setAppearance({ size })}
              >
                {size === 'small' ? 'A−' : 'A+'}
              </button>
            ))}
            {TEXT_APPEARANCE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`文字顏色：${color}`}
                aria-pressed={editor.isActive('textAppearance', { color })}
                className={`tiptap-appearance-color tiptap-appearance-color-${color}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setAppearance({ color })}
              >
                ●
              </button>
            ))}
            <button
              type="button"
              aria-label="清除文字外觀"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setAppearance({})}
            >
              清除
            </button>
          </div>
        )}
      </div>
      <div className="tiptap-editor-status" role="status" aria-live="polite">
        {documentStats.words} 字詞 · {documentStats.characters} 字元
      </div>
      <button type="button" className="secondary" onClick={() => setRichMode(false)}>
        回到 Markdown 模式
      </button>
    </div>
  );
}
