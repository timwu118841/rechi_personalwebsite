import { formatDate, readingTimeMinutes } from '@/lib/article-rules';
import { renderMarkdown } from '@/lib/content/markdown';
import type { SiteSettings } from '@/lib/content/types';

export interface ArticlePreviewData {
  title: string;
  description: string;
  bodyMarkdown: string;
  slug?: string | null;
  categorySlug?: string | null;
  contentTypeSlug?: string | null;
  tags?: string[];
  activationAt?: string | null;
}

export interface ArticlePreviewContext {
  settings: Partial<SiteSettings> | null;
  categoryName?: string | null;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ||
      character,
  );
}

function previewDate(value: string | null | undefined): string {
  const date = value ? new Date(value) : new Date();
  return formatDate(Number.isNaN(date.getTime()) ? new Date() : date);
}

function contentTypeName(slug: string | null | undefined): string {
  if (!slug || slug === 'legal-articles') return '法律文章';
  return slug;
}

export function buildArticlePreviewDocument(
  preview: ArticlePreviewData,
  context: ArticlePreviewContext,
  stylesheetUrl: string,
): string {
  const settings = context.settings ?? {};
  const siteTitle = settings.siteTitle || settings.shortTitle || '法律實務筆記';
  const shortTitle = settings.shortTitle || siteTitle;
  const siteDescription = settings.siteDescription || '從實務現場出發，整理可帶走的法律判斷方法。';
  const authorName = settings.authorName || '站方作者';
  const categoryName = context.categoryName || preview.categorySlug || '未分類';
  const typeName = contentTypeName(preview.contentTypeSlug);
  const bodyHtml = renderMarkdown(preview.bodyMarkdown);
  const minutes = readingTimeMinutes(preview.bodyMarkdown);
  const tags = (preview.tags ?? [])
    .map((tag) => `<li><span class="tag">${escapeHtml(tag)}</span></li>`)
    .join('');
  const authorAvatar = settings.authorImage
    ? `<img class="author-avatar-image" src="${escapeHtml(settings.authorImage.url)}" alt="" width="${settings.authorImage.width}" height="${settings.authorImage.height}" />`
    : `<span class="author-avatar" aria-hidden="true">${escapeHtml(authorName.slice(0, 1))}</span>`;

  return `<!doctype html>
<html lang="zh-Hant-TW">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>${escapeHtml(preview.title)}｜前台預覽</title>
    <link rel="stylesheet" href="${escapeHtml(stylesheetUrl)}" />
  </head>
  <body>
    <a class="skip-link" href="#main-content">跳到主要內容</a>
    <header class="site-header">
      <div class="container header-inner">
        <a class="brand" href="#" aria-label="${escapeHtml(siteTitle)}首頁">
          <span class="brand-mark" aria-hidden="true">R</span>
          <span class="brand-copy"><strong>${escapeHtml(shortTitle)}</strong><small>法律 × 實務 × 思考</small></span>
        </a>
        <nav class="site-nav" aria-label="主要導覽">
          <a href="#">首頁</a><a href="#" aria-current="page">文章</a><a href="#">分類</a><a href="#">關於</a>
          <a class="search-link" href="#"><span>搜尋</span></a>
        </nav>
      </div>
    </header>
    <main id="main-content" tabindex="-1">
      <article data-article-slug="${escapeHtml(preview.slug || 'preview')}">
        <header class="article-header container">
          <nav class="breadcrumbs" aria-label="麵包屑"><a href="#">首頁</a><span aria-hidden="true">/</span><a href="#">文章</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(categoryName)}</span></nav>
          <div class="article-heading-grid">
            <div class="article-heading-copy">
              <p class="eyebrow">${escapeHtml(typeName)} · ${escapeHtml(categoryName)}</p>
              <h1>${escapeHtml(preview.title)}</h1>
              <p class="article-dek">${escapeHtml(preview.description)}</p>
            </div>
            <aside class="article-facts" aria-label="文章資訊">
              <span class="article-facts-label">Article preview</span>
              <dl>
                <div><dt>作者</dt><dd><span class="author-chip">${authorAvatar}${escapeHtml(authorName)}</span></dd></div>
                <div><dt>發布</dt><dd><time>${escapeHtml(previewDate(preview.activationAt))}</time></dd></div>
                <div><dt>狀態</dt><dd>預覽版本</dd></div>
                <div><dt>閱讀</dt><dd>${minutes} 分鐘</dd></div>
              </dl>
            </aside>
          </div>
        </header>
        <div class="container article-layout">
          <aside class="article-rail" aria-label="文章探索"><p class="eyebrow">Filed under</p><a href="#">${escapeHtml(categoryName)}</a><span class="rail-rule" aria-hidden="true"></span><a href="#">← 返回所有文章</a></aside>
          <div class="reading-container article-reading">
            <div class="prose">${bodyHtml}</div>
            <div class="article-end">
              <div class="article-end-heading"><p class="eyebrow">Continue exploring</p><h2>延伸探索</h2></div>
              ${tags ? `<ul class="tag-list" aria-label="文章標籤">${tags}</ul>` : ''}
              <aside class="disclaimer" aria-label="法律資訊免責聲明"><strong>閱讀提醒</strong><p>本站內容僅供法律資訊與經驗分享，不構成個案法律意見。</p></aside>
              <div class="share-row" aria-label="分享文章"><strong>分享這篇文章</strong><a href="#">Facebook ↗</a><a href="#">LinkedIn ↗</a><a href="#">Email ↗</a></div>
            </div>
          </div>
        </div>
      </article>
    </main>
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid"><div class="footer-intro"><span class="footer-mark" aria-hidden="true">R</span><div><p class="footer-title">${escapeHtml(siteTitle)}</p><p class="footer-copy">${escapeHtml(siteDescription)}</p></div></div><div class="footer-navs"><nav class="footer-links" aria-label="內容導覽"><strong>探索</strong><a href="#">所有文章</a><a href="#">文章分類</a><a href="#">文章標籤</a></nav></div></div>
        <div class="footer-bottom"><span>© ${new Date().getFullYear()} ${escapeHtml(authorName)}</span><span class="footer-note">※ 法律資訊與經驗分享，不構成個案法律意見。</span></div>
      </div>
    </footer>
  </body>
</html>`;
}
