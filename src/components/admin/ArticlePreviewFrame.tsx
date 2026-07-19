import { useMemo } from 'react';
import type { SiteSettings } from '@/lib/content/types';
import publicStylesUrl from '@/styles/global.css?url';
import { buildArticlePreviewDocument, type ArticlePreviewData } from './article-preview-document';

export function ArticlePreviewFrame({
  preview,
  settings,
  categoryName,
}: {
  preview: ArticlePreviewData;
  settings: Partial<SiteSettings> | null;
  categoryName?: string | null;
}) {
  const document = useMemo(
    () => buildArticlePreviewDocument(preview, { settings, categoryName }, publicStylesUrl),
    [categoryName, preview, settings],
  );

  return (
    <iframe
      className="admin-preview-frame"
      title="前台文章預覽"
      srcDoc={document}
      sandbox=""
      referrerPolicy="no-referrer"
    />
  );
}
