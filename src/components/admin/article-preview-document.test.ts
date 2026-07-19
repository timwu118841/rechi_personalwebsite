import { describe, expect, it } from 'vitest';
import { buildArticlePreviewDocument } from './article-preview-document';

describe('buildArticlePreviewDocument', () => {
  it('uses the public article shell and sanitizes preview Markdown', () => {
    const document = buildArticlePreviewDocument(
      {
        title: '預覽 <script>',
        description: '摘要',
        bodyMarkdown: '## 正文\n\n<script>alert(1)</script>\n\n**安全內容**',
        tags: ['勞動法'],
        contentTypeSlug: 'legal-articles',
        categorySlug: 'legal-practice',
      },
      {
        settings: { siteTitle: '測試站', shortTitle: '測試', authorName: '作者' },
        categoryName: '法律實務',
      },
      '/assets/global.css',
    );

    expect(document).toContain('class="site-header"');
    expect(document).toContain('class="article-header container"');
    expect(document).toContain('class="container article-layout"');
    expect(document).toContain('class="prose"');
    expect(document).toContain('class="site-footer"');
    expect(document).toContain('<h2>正文</h2>');
    expect(document).toContain('<strong>安全內容</strong>');
    expect(document).not.toContain('<script>');
    expect(document).toContain('預覽 &lt;script&gt;');
  });
});
