import { useState } from 'react';
import MarkdownTiptapEditor from './MarkdownTiptapEditor';

const initialDocument = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: '選取這段文字' }] }],
};

export default function EditorFixtureApp() {
  const [markdown, setMarkdown] = useState('選取這段文字');
  const [capturedDocument, setCapturedDocument] = useState<unknown>(initialDocument);
  return (
    <main>
      <h1>Editor fixture</h1>
      <MarkdownTiptapEditor
        value={markdown}
        bodyJson={initialDocument}
        onChange={(next) => {
          setMarkdown(next);
          globalThis.document
            .querySelector<HTMLElement>('[data-testid="editor-markdown"]')
            ?.setAttribute('data-value', next);
        }}
        onDocumentChange={(next) => {
          setCapturedDocument(next);
          globalThis.document
            .querySelector<HTMLElement>('[data-testid="editor-json"]')
            ?.setAttribute('data-value', JSON.stringify(next));
        }}
      />
      <output data-testid="editor-markdown" data-value={markdown} />
      <output data-testid="editor-json" data-value={JSON.stringify(capturedDocument)} />
    </main>
  );
}
