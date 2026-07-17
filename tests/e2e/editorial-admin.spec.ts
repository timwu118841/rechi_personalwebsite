import { expect, test } from '@playwright/test';

test.skip(
  !['1', 'true'].includes(process.env.ALLOW_FIXTURE_CONTENT ?? ''),
  'requires ALLOW_FIXTURE_CONTENT',
);

const requestLogs = new WeakMap<object, string[]>();
const candidateId = `candidate-${'a'.repeat(96)}`;
const jobId = `job-${'b'.repeat(96)}`;
const longTitle = `待發布文章-${'超長標題'.repeat(28)}`;
const longContent = `https://media.example/private/image.png?token=fixture-secret-${'x'.repeat(180)}`;

const activeCandidate = {
  id: candidateId,
  source_revision_id: 'revision-1',
  working_copy_version: 3,
  candidate_hash: 'candidate-hash-1',
  state: 'prepared',
  activation_at: '2020-01-01T00:00:00.000Z',
  title: longTitle,
  failure_reason: null as string | null,
};
const historyCandidate = {
  ...activeCandidate,
  id: 'candidate-history',
  state: 'published',
  title: '歷史文章',
};
const publishedArticle = {
  id: 'article-published-1',
  slug: 'published-article',
  title: '已發布的法律文章',
  description: '這是一篇已經公開在網站上的文章。',
  body: '文章內容',
  status: 'published',
  publicationVersion: 3,
  publishedAt: '2026-07-15T08:00:00.000Z',
  contentType: 'legal',
  category: 'practice',
  tags: [],
  featured: false,
  privacyReviewed: true,
  legalReviewed: true,
};
const activeSource = {
  id: 'source-active-1',
  external_id: 'notion-page-1',
  state: 'active',
  article_id: publishedArticle.id,
  working_copy_id: 'working-copy-1',
  working_copy_version: 3,
  manual_summary: null as string | null,
  slug: 'published-article',
  page_title: '勞動法實務筆記',
  last_synced_at: '2026-07-17T12:00:00.000Z',
};

test.describe('受保護的 Notion 編輯發布後台', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    let candidate = {
      ...activeCandidate,
      state: testInfo.title.includes('ready_to_activate')
        ? 'ready_to_activate'
        : activeCandidate.state,
    };
    let source = { ...activeSource };
    let publishRequested = false;
    let articles = [
      publishedArticle,
      { ...publishedArticle, id: 'article-draft-1', title: '尚未發布的草稿', status: 'draft' },
    ];
    const requests: string[] = [];
    requestLogs.set(page, requests);
    await page.route('**/api/admin/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      requests.push(`${request.method()} ${url.pathname}${url.search}`);
      let body: unknown;
      if (url.pathname === '/api/admin/articles') body = { articles };
      else if (url.pathname === '/api/admin/settings')
        body = { settings: { shortTitle: '測試站' } };
      else if (url.pathname === '/api/admin/taxonomies')
        body = { categories: [], contentTypes: [] };
      else if (url.pathname === '/api/admin/notion/sources') body = { sources: [source] };
      else if (
        url.pathname === `/api/admin/notion/sources/${activeSource.id}` &&
        request.method() === 'PATCH'
      ) {
        const input = request.postDataJSON();
        source = {
          ...source,
          manual_summary: input.summary,
          working_copy_version: source.working_copy_version + 1,
        };
        requests.push(`SUMMARY ${JSON.stringify(input)}`);
        body = {
          workingCopy: {
            id: source.working_copy_id,
            source_id: source.id,
            version: source.working_copy_version,
            manual_summary: source.manual_summary,
          },
        };
      } else if (url.pathname === '/api/admin/notion/candidates') {
        let candidates = [candidate];
        if (url.searchParams.get('view') === 'history') candidates = [historyCandidate];
        else if (publishRequested) candidates = [];
        body = {
          candidates,
        };
      } else if (
        url.pathname === `/api/admin/notion/candidates/${candidateId}` &&
        request.method() === 'GET'
      ) {
        candidate = testInfo.title.includes('database function failure')
          ? candidate
          : testInfo.title.includes('media failure')
            ? {
                ...candidate,
                state: 'media_failed',
                failure_reason:
                  'download failed https://media.example/image.png?token=fixture-secret token=fixture-secret',
              }
            : { ...candidate, state: 'published' };
        body = { candidate };
      } else if (url.pathname === `/api/admin/notion/candidates/${candidateId}/publish`) {
        publishRequested = true;
        body = { publication: { id: jobId, candidate_id: candidateId, state: 'queued' } };
      } else if (url.pathname === `/api/admin/notion/candidates/${candidateId}/preview`) {
        body = {
          preview: { title: longTitle, description: longContent, bodyMarkdown: longContent },
        };
      } else if (url.pathname === '/api/admin/notion/worker') {
        body = {
          accepted: true,
          result: { claimed: 1, completed: 1, failed: 0, exhaustedBudget: false },
        };
      } else if (url.pathname === '/api/admin/notion/sync' && request.method() === 'POST') {
        const input = request.postDataJSON();
        requests.push(`SYNC ${JSON.stringify({ sourceId: input.sourceId })}`);
        body = { accepted: true, job: { id: 'sync-job-1', state: 'queued' } };
      } else if (url.pathname === `/api/admin/notion/jobs/${jobId}`) {
        body = {
          job: {
            id: jobId,
            candidate_id: testInfo.title.includes('mismatched job')
              ? 'different-candidate'
              : candidateId,
            state: testInfo.title.includes('database function failure') ? 'queued' : 'succeeded',
            error: testInfo.title.includes('database function failure')
              ? 'column reference "publication_version" is ambiguous'
              : null,
          },
        };
      } else if (url.pathname === `/api/admin/notion/articles/${publishedArticle.id}/unpublish`) {
        const input = request.postDataJSON();
        requests.push(`UNPUBLISH ${JSON.stringify(input)}`);
        articles = articles.map((article) =>
          article.id === publishedArticle.id ? { ...article, status: 'unpublished' } : article,
        );
        body = { publication: { article_id: publishedArticle.id, publication_version: 4 } };
      } else {
        body = { ok: true };
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });
    await page.goto('/admin-fixture');
    await expect(page.getByRole('heading', { name: 'Notion 文章發布' })).toBeVisible();
  });

  test('does not expose Notion privacy/legal controls and filters active/history candidates', async ({
    page,
  }) => {
    await expect(page.getByText(longTitle)).toBeVisible();
    await expect(page.getByLabel('狀態：待發布')).toBeVisible();
    await expect(page.getByText('歷史文章')).toHaveCount(0);
    await expect(page.getByText(/隱私審查|法律審查|privacyReviewed|legalReviewed/i)).toHaveCount(0);
    await page.getByRole('button', { name: new RegExp(longTitle.slice(0, 12)) }).click();
    await expect(page.getByText(/候選 hash|candidate-hash-1/i)).toHaveCount(0);
    await page.getByRole('tab', { name: '歷史紀錄' }).click();
    await expect(page.getByText('歷史文章')).toBeVisible();
    await expect(page.getByText(longTitle)).toHaveCount(0);
    await page.getByRole('tab', { name: '進行中' }).click();
    await expect(page.getByText(longTitle)).toBeVisible();
  });

  test('keeps sources compact and reveals controls only for the selected row', async ({ page }) => {
    const sourceRow = page.locator('.admin-source-row');
    await expect(sourceRow).toHaveCount(1);
    await expect(sourceRow).toContainText(activeSource.page_title);
    await expect(sourceRow).toContainText(`Slug：${activeSource.slug}`);
    await expect(page.getByLabel('狀態：已啟用')).toBeVisible();
    await expect(page.getByLabel('手動設定網址代稱')).toHaveCount(0);

    await page.getByRole('button', { name: '管理', exact: true }).click();
    await expect(page.getByLabel('手動設定網址代稱')).toBeVisible();
    const prepareButton = page.getByRole('button', { name: '建立發布候選' });
    await expect(prepareButton).toBeDisabled();
    await expect(page.getByRole('button', { name: '同步 Notion 最新內容' })).toBeVisible();
    const summary = '這是一段由管理者手動撰寫的文章摘要，不會被 Notion 正文同步覆寫。';
    await page.getByLabel('文章摘要').fill(summary);
    await page.getByRole('button', { name: '儲存摘要' }).click();
    await expect(page.getByRole('status')).toContainText('文章摘要已儲存');
    await expect(prepareButton).toBeEnabled();
    await page.getByRole('button', { name: '收起' }).click();
    await expect(page.getByLabel('手動設定網址代稱')).toHaveCount(0);

    const requests = requestLogs.get(page) || [];
    expect(requests).toContain('GET /api/admin/notion/sources?view=all');
    expect(
      requests.some((entry) =>
        entry.startsWith(`SUMMARY {"summary":"${summary}","expectedWorkingCopyVersion":3}`),
      ),
    ).toBe(true);
  });

  test('publishes an overdue prepared candidate and polls exact job/candidate endpoints', async ({
    page,
  }) => {
    await page.getByRole('button', { name: new RegExp(longTitle.slice(0, 12)) }).click();
    const immediate = page.getByRole('button', { name: '立即發布' });
    await expect(immediate).toBeEnabled();
    await immediate.click();
    await page.getByRole('button', { name: '確認立即發布' }).click();
    await expect(page.getByText('發布完成', { exact: true })).toBeVisible();
    const diagnostic = page.locator('.admin-publication-diagnostic[role="status"]');
    await expect(diagnostic).toContainText(candidateId);
    await expect(diagnostic).toContainText(jobId);
    await expect(page.getByText('目前沒有進行中的發布候選。')).toBeVisible();
    const requests = requestLogs.get(page) || [];
    expect(requests).toContain(
      `POST /api/admin/notion/candidates/${candidateId}/publish?immediate=true`,
    );
    expect(requests).toContain(`GET /api/admin/notion/candidates/${candidateId}`);
    expect(requests).toContain(`GET /api/admin/notion/jobs/${jobId}`);
  });

  test('renders accessible sanitized media failure diagnostics with exact IDs', async ({
    page,
  }) => {
    await page.getByRole('button', { name: new RegExp(longTitle.slice(0, 12)) }).click();
    await page.getByRole('button', { name: '立即發布' }).click();
    await page.getByRole('button', { name: '確認立即發布' }).click();
    const diagnostic = page.locator('.admin-publication-diagnostic[role="alert"]');
    await expect(diagnostic).toContainText('媒體處理失敗');
    await expect(diagnostic).toContainText(candidateId);
    await expect(diagnostic).toContainText(jobId);
    await expect(diagnostic).not.toContainText('fixture-secret');
  });

  test('rejects a mismatched job candidate with an accessible diagnostic', async ({ page }) => {
    await page.getByRole('button', { name: new RegExp(longTitle.slice(0, 12)) }).click();
    await page.getByRole('button', { name: '立即發布' }).click();
    await page.getByRole('button', { name: '確認立即發布' }).click();
    const diagnostic = page.locator('.admin-publication-diagnostic[role="alert"]');
    await expect(diagnostic).toContainText('工作與候選不符');
    await expect(diagnostic).toContainText(candidateId);
    await expect(diagnostic).toContainText(jobId);
  });

  test('reports a database function failure immediately instead of timing out', async ({
    page,
  }) => {
    await page.getByRole('button', { name: new RegExp(longTitle.slice(0, 12)) }).click();
    await page.getByRole('button', { name: '立即發布' }).click();
    await page.getByRole('button', { name: '確認立即發布' }).click();
    const diagnostic = page.locator('.admin-publication-diagnostic[role="alert"]');
    await expect(diagnostic).toContainText('資料庫版本尚未更新');
    await expect(diagnostic).not.toContainText('等待發布結果逾時');
  });

  test('shows accessible feedback for a deterministic sync and worker transition', async ({
    page,
  }) => {
    await page.getByLabel('Notion page ID').fill('page-fixture-1');
    await page.getByRole('button', { name: '立即同步', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Notion 頁面同步完成');
    await expect(page.getByRole('status')).toContainText('處理 1/1 個工作，失敗 0 個');
  });

  test('allows an overdue ready_to_activate candidate to publish immediately', async ({ page }) => {
    await page.getByRole('button', { name: new RegExp(longTitle.slice(0, 12)) }).click();
    await expect(page.getByRole('button', { name: '立即發布' })).toBeEnabled();
  });

  test('keeps the dashboard within the viewport on desktop and mobile', async ({ page }) => {
    await page.getByRole('button', { name: new RegExp(longTitle.slice(0, 12)) }).click();
    await page.getByRole('button', { name: '載入預覽' }).click();
    await expect(page.locator('.admin-preview-content')).toContainText(longTitle);
    await expect(page.locator('.admin-preview-dialog')).toHaveAttribute('role', 'dialog');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  test('keeps an unpublished article manageable and directs republishing through fresh Notion sync', async ({
    page,
  }) => {
    await page.getByRole('button', { name: '文章管理' }).click();
    await expect(page.getByRole('heading', { name: '文章管理' })).toBeVisible();
    await expect(page.getByText(publishedArticle.title)).toBeVisible();
    await expect(page.getByText('尚未發布的草稿')).toHaveCount(0);
    await expect(page.getByLabel('狀態：已發布')).toBeVisible();

    await page.getByRole('button', { name: '下架文章' }).click();
    await expect(page.getByRole('dialog', { name: '確定要下架這篇文章？' })).toBeVisible();
    await page.getByLabel('備註（選填）').fill('內容需要更新');
    await page.getByRole('button', { name: '確認下架' }).click();

    await expect(page.getByRole('dialog', { name: '確定要下架這篇文章？' })).toBeHidden();
    await expect(page.getByRole('heading', { name: publishedArticle.title })).toBeVisible();
    await expect(page.getByLabel('狀態：已下架')).toBeVisible();
    await page.getByRole('button', { name: '從 Notion 重新發布' }).click();
    await expect(page.getByRole('heading', { name: 'Notion 文章發布' })).toBeVisible();
    await expect(page.getByRole('button', { name: '同步 Notion 最新內容' })).toBeVisible();
    await page.getByRole('button', { name: '同步 Notion 最新內容' }).click();
    await expect(page.getByRole('status')).toContainText('Notion 最新內容同步完成');

    const requests = requestLogs.get(page) || [];
    expect(requests).toContain(`POST /api/admin/notion/articles/${publishedArticle.id}/unpublish`);
    expect(requests).toContain('POST /api/admin/notion/sync');
    expect(requests.some((entry) => entry === 'SYNC {"sourceId":"source-active-1"}')).toBe(true);
    expect(
      requests.some((entry) =>
        entry.startsWith(
          'UNPUBLISH {"expectedPublicationVersion":3,"reason":"內容需要更新","idempotencyKey":',
        ),
      ),
    ).toBe(true);
  });
});
