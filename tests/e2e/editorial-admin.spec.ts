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
const unbrokenSummary = 'test'.repeat(120);

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
  description: unbrokenSummary,
  body: '文章內容',
  status: 'published',
  publicationVersion: 3,
  publishedAt: '2026-07-15T08:00:00.000Z',
  contentType: 'legal',
  category: 'legal-practice',
  tags: ['既有標籤'],
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
  category_slug: 'legal-practice',
  tags: ['既有標籤'],
  page_title: '勞動法實務筆記',
  last_synced_at: '2026-07-17T12:00:00.000Z',
};
type FixtureSource = Omit<typeof activeSource, 'working_copy_id' | 'working_copy_version'> & {
  working_copy_id: string | null;
  working_copy_version: number | null;
  last_error: string | null;
};
const legalCategory = {
  slug: 'legal-practice',
  name: '法律實務',
  description: '從契約、爭議與日常法律工作中整理可帶走的判斷方法。',
  order: 10,
  visible: true,
};
const legalContentType = {
  slug: 'legal-articles',
  name: '法律文章',
  description: '系統內部使用的文章格式。',
};

test.describe('受保護的 Notion 編輯發布後台', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    let candidate = {
      ...activeCandidate,
      state: testInfo.title.includes('ready_to_activate')
        ? 'ready_to_activate'
        : activeCandidate.state,
    };
    let source: FixtureSource = testInfo.title.includes('onboarding source')
      ? {
          ...activeSource,
          state: 'onboarding',
          working_copy_id: null,
          working_copy_version: null,
          last_error: null,
        }
      : { ...activeSource, last_error: null as string | null };
    let categories = [{ ...legalCategory }];
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
      let status = 200;
      if (url.pathname === '/api/admin/articles') body = { articles };
      else if (url.pathname === '/api/admin/settings')
        body = { settings: { shortTitle: '測試站' } };
      else if (url.pathname === '/api/admin/taxonomies') {
        if (request.method() === 'POST') {
          const input = request.postDataJSON();
          requests.push(`TAXONOMY ${JSON.stringify(input)}`);
          if (input.kind === 'category') {
            categories = categories.some((item) => item.slug === input.value.slug)
              ? categories.map((item) =>
                  item.slug === input.value.slug ? { ...input.value } : item,
                )
              : [...categories, { ...input.value }];
          }
          body = { item: input.value };
        } else {
          body = { categories, contentTypes: [legalContentType] };
        }
      } else if (url.pathname === '/api/admin/notion/sources') body = { sources: [source] };
      else if (
        url.pathname === `/api/admin/notion/sources/${activeSource.id}` &&
        request.method() === 'PATCH'
      ) {
        const input = request.postDataJSON();
        source = {
          ...source,
          manual_summary: input.summary,
          working_copy_version: (source.working_copy_version ?? 0) + 1,
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
      } else if (
        url.pathname === `/api/admin/notion/sources/${activeSource.id}/classification` &&
        request.method() === 'PATCH'
      ) {
        const input = request.postDataJSON();
        source = {
          ...source,
          category_slug: input.category,
          tags: input.tags,
          working_copy_version: (source.working_copy_version ?? 0) + 1,
        };
        requests.push(`SOURCE_CLASSIFICATION ${JSON.stringify(input)}`);
        body = {
          workingCopy: { id: source.working_copy_id, version: source.working_copy_version },
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
      } else if (url.pathname === '/api/admin/notion/sync/plan') {
        body = {
          plan: testInfo.title.includes('no changed articles')
            ? { scanned: 3, skipped: 3, targets: [] }
            : {
                scanned: 4,
                skipped: 2,
                targets: [
                  {
                    pageId: 'changed-page-1',
                    sourceId: 'changed-source-1',
                    title: '已更新文章一',
                    lastEditedTime: '2026-07-19T01:00:00.000Z',
                  },
                  {
                    pageId: 'changed-page-2',
                    sourceId: null,
                    title: '新增文章二',
                    lastEditedTime: '2026-07-19T02:00:00.000Z',
                  },
                ],
              },
        };
      } else if (url.pathname === '/api/admin/notion/sync' && request.method() === 'POST') {
        const input = request.postDataJSON();
        requests.push(`SYNC ${JSON.stringify({ sourceId: input.sourceId, pageId: input.pageId })}`);
        if (testInfo.title.includes('per-article failure') && input.pageId === 'changed-page-2') {
          status = 502;
          body = { message: 'Notion image download failed with 403.' };
        } else {
          body = {
            accepted: true,
            result: {
              sourceId: input.sourceId || 'new-source-2',
              pageId: input.pageId || 'changed-page-1',
              title: input.pageId === 'changed-page-2' ? '新增文章二' : '已更新文章一',
              state: 'active',
            },
          };
        }
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
      } else if (
        url.pathname === `/api/admin/articles/${publishedArticle.id}/featured` &&
        request.method() === 'PATCH'
      ) {
        const input = request.postDataJSON();
        requests.push(`FEATURED ${JSON.stringify(input)}`);
        articles = articles.map((article) => ({
          ...article,
          featured: article.id === publishedArticle.id ? input.featured : false,
        }));
        body = { article: articles.find((article) => article.id === publishedArticle.id) };
      } else if (
        url.pathname === `/api/admin/articles/${publishedArticle.id}/classification` &&
        request.method() === 'PATCH'
      ) {
        const input = request.postDataJSON();
        requests.push(`ARTICLE_CLASSIFICATION ${JSON.stringify(input)}`);
        articles = articles.map((article) =>
          article.id === publishedArticle.id
            ? { ...article, category: input.category, tags: input.tags }
            : article,
        );
        body = { article: articles.find((article) => article.id === publishedArticle.id) };
      } else {
        body = { ok: true };
      }
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });
    await page.goto('/admin-fixture');
    await expect(page.getByRole('heading', { name: '文章管理', exact: true })).toBeVisible();
  });

  test('uses one article workspace and keeps Notion limited to synchronization', async ({
    page,
  }) => {
    await expect(page.getByRole('button', { name: 'Notion 發布' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '文章管理' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    const syncSection = page.locator('#notion-sync');
    await expect(syncSection.getByRole('heading', { name: 'Notion 同步' })).toBeVisible();
    const syncDatabaseButton = syncSection.getByRole('button', { name: '同步文章資料庫' });
    await expect(syncDatabaseButton).toBeVisible();
    await syncDatabaseButton.click();
    await expect(page.getByRole('status')).toContainText('同步成功 2 篇');
    expect(requestLogs.get(page)).toContain('GET /api/admin/notion/sync/plan');
    await page
      .getByRole('dialog', { name: 'Notion 文章同步進度' })
      .getByRole('button', { name: '關閉' })
      .click();
    await expect(syncSection.getByLabel('文章摘要')).toHaveCount(0);
    await expect(syncSection.getByLabel('手動設定網址代稱')).toHaveCount(0);

    const publishingSection = page.locator('#article-publishing-content');
    await expect(page.getByRole('heading', { name: '待發布文章' })).toBeVisible();
    await publishingSection.getByRole('button', { name: '管理', exact: true }).click();
    await expect(publishingSection.getByLabel('文章摘要')).toBeVisible();
    await expect(publishingSection.getByLabel('手動設定網址代稱')).toBeVisible();
    await expect(publishingSection.getByLabel('文章分類')).toBeVisible();
    await expect(publishingSection.getByLabel('文章標籤')).toBeVisible();
    await expect(page.locator('#published-articles')).toContainText(publishedArticle.title);
    const articleCard = page.locator('.admin-article-card').first();
    expect(await articleCard.evaluate((card) => card.scrollWidth <= card.clientWidth)).toBe(true);
    expect(
      await articleCard
        .locator('p')
        .evaluate((summary) => summary.scrollWidth <= summary.clientWidth),
    ).toBe(true);
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
    await expect(page.getByLabel('狀態：同步完成')).toBeVisible();
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
    const immediate = page.getByRole('button', { name: '立即發布', exact: true });
    await expect(immediate).toBeEnabled();
    await immediate.click();
    await page.getByRole('button', { name: '確認立即發布' }).click();
    await expect(page.getByText('發布完成', { exact: true })).toBeVisible();
    const diagnostic = page.locator('.admin-publication-diagnostic[role="status"]');
    await expect(diagnostic).toContainText(candidateId);
    await expect(diagnostic).toContainText(jobId);
    await expect(page.getByText('目前沒有進行中的發布候選。')).toBeVisible();
    const requests = requestLogs.get(page) || [];
    expect(requests).toContain(`POST /api/admin/notion/candidates/${candidateId}/publish`);
    expect(requests).toContain(`GET /api/admin/notion/candidates/${candidateId}`);
    expect(requests).toContain(`GET /api/admin/notion/jobs/${jobId}`);
  });

  test('renders accessible sanitized media failure diagnostics with exact IDs', async ({
    page,
  }) => {
    await page.getByRole('button', { name: new RegExp(longTitle.slice(0, 12)) }).click();
    await page.getByRole('button', { name: '立即發布', exact: true }).click();
    await page.getByRole('button', { name: '確認立即發布' }).click();
    const diagnostic = page.locator('.admin-publication-diagnostic[role="alert"]');
    await expect(diagnostic).toContainText('媒體處理失敗');
    await expect(diagnostic).toContainText(candidateId);
    await expect(diagnostic).toContainText(jobId);
    await expect(diagnostic).not.toContainText('fixture-secret');
  });

  test('rejects a mismatched job candidate with an accessible diagnostic', async ({ page }) => {
    await page.getByRole('button', { name: new RegExp(longTitle.slice(0, 12)) }).click();
    await page.getByRole('button', { name: '立即發布', exact: true }).click();
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
    await page.getByRole('button', { name: '立即發布', exact: true }).click();
    await page.getByRole('button', { name: '確認立即發布' }).click();
    const diagnostic = page.locator('.admin-publication-diagnostic[role="alert"]');
    await expect(diagnostic).toContainText('資料庫版本尚未更新');
    await expect(diagnostic).not.toContainText('等待發布結果逾時');
  });

  test('synchronizes one page directly without invoking the worker', async ({ page }) => {
    const pageIdInput = page.getByLabel('Notion page ID');
    await pageIdInput.fill('page-fixture-1');
    await expect(pageIdInput).toHaveValue('page-fixture-1');
    await pageIdInput.press('Tab');
    await page.getByRole('button', { name: '立即同步', exact: true }).click();
    const diagnostic = page.locator('.admin-sync-diagnostic');
    await expect(diagnostic).toContainText('Notion 頁面同步完成');
    expect(requestLogs.get(page)).toContain('SYNC {"pageId":"page-fixture-1"}');
    expect(requestLogs.get(page)).not.toContain('POST /api/admin/notion/worker');
  });

  test('synchronizes changed database articles independently with visible progress', async ({
    page,
  }) => {
    await page.getByRole('button', { name: '同步文章資料庫' }).click();

    const progress = page.getByRole('dialog', { name: 'Notion 文章同步進度' });
    await expect(progress).toBeVisible();
    await expect(progress).toContainText('已完成 2 / 2 篇');
    await expect(progress.getByText('完成', { exact: true })).toHaveCount(2);
    await expect(page.locator('.admin-sync-diagnostic')).toContainText(
      '已檢查 4 篇，跳過 2 篇未變更文章；同步成功 2 篇',
    );
    const requests = requestLogs.get(page) || [];
    expect(requests).toContain('GET /api/admin/notion/sync/plan');
    expect(requests).toContain('SYNC {"sourceId":"changed-source-1"}');
    expect(requests).toContain('SYNC {"pageId":"changed-page-2"}');
    expect(requests).not.toContain('POST /api/admin/notion/worker');
  });

  test('keeps per-article failure details while completing the remaining articles', async ({
    page,
  }) => {
    await page.getByRole('button', { name: '同步文章資料庫' }).click();

    const progress = page.getByRole('dialog', { name: 'Notion 文章同步進度' });
    await expect(progress).toContainText('已完成 2 / 2 篇');
    await expect(progress).toContainText('Notion image download failed with 403');
    await expect(progress.getByText('完成', { exact: true })).toHaveCount(1);
    await expect(progress.getByText('失敗', { exact: true })).toHaveCount(1);
    const diagnostic = page.locator('.admin-sync-diagnostic[role="alert"]');
    await expect(diagnostic).toContainText('同步成功 1 篇，失敗 1 篇');
  });

  test('finishes immediately when the database has no changed articles', async ({ page }) => {
    await page.getByRole('button', { name: '同步文章資料庫' }).click();

    await expect(page.locator('.admin-sync-diagnostic')).toContainText(
      '已檢查 3 篇文章，全部都是最新版本，不需要同步',
    );
    expect(
      requestLogs.get(page)?.filter((entry) => entry === 'POST /api/admin/notion/sync'),
    ).toEqual([]);
  });

  test('explains that an onboarding source needs a direct content synchronization', async ({
    page,
  }) => {
    const sourceRow = page.locator('.admin-source-row');
    await expect(sourceRow.getByLabel('狀態：需要同步')).toBeVisible();
    await expect(sourceRow).toContainText('正文尚未完成同步；請重新執行此文章同步');
    await expect(sourceRow).not.toContainText('設定中');
  });

  test('allows an overdue ready_to_activate candidate to publish immediately', async ({ page }) => {
    await page.getByRole('button', { name: new RegExp(longTitle.slice(0, 12)) }).click();
    await expect(page.getByRole('button', { name: '立即發布', exact: true })).toBeEnabled();
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
    const publishedSection = page.locator('#published-articles');
    await expect(page.getByRole('heading', { name: '文章管理', exact: true })).toBeVisible();
    await expect(publishedSection.getByText(publishedArticle.title)).toBeVisible();
    await expect(publishedSection.getByText('尚未發布的草稿')).toHaveCount(0);
    await expect(publishedSection.getByLabel('狀態：已發布')).toBeVisible();

    await publishedSection.getByRole('button', { name: '下架文章' }).click();
    await expect(page.getByRole('dialog', { name: '確定要下架這篇文章？' })).toBeVisible();
    await page.getByLabel('備註（選填）').fill('內容需要更新');
    await page.getByRole('button', { name: '確認下架' }).click();

    await expect(page.getByRole('dialog', { name: '確定要下架這篇文章？' })).toBeHidden();
    await expect(
      publishedSection.getByRole('heading', { name: publishedArticle.title }),
    ).toBeVisible();
    await expect(publishedSection.getByLabel('狀態：已下架')).toBeVisible();
    await publishedSection.getByRole('button', { name: '從 Notion 重新發布' }).click();
    await expect(page.getByRole('heading', { name: '文章管理', exact: true })).toBeVisible();
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

  test('sets and clears the featured article from the published article list', async ({ page }) => {
    const publishedSection = page.locator('#published-articles');

    await publishedSection.getByRole('button', { name: '設為精選文章' }).click();
    await expect(publishedSection.getByText('精選文章', { exact: true })).toBeVisible();
    await expect(publishedSection.getByRole('button', { name: '取消精選文章' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const requests = requestLogs.get(page) || [];
    expect(requests).toContain(`PATCH /api/admin/articles/${publishedArticle.id}/featured`);
    expect(requests).toContain('FEATURED {"featured":true}');
  });

  test('edits category and tags before publication and on a published article', async ({
    page,
  }) => {
    const publishingSection = page.locator('#article-publishing-content');
    await publishingSection.getByRole('button', { name: '管理', exact: true }).click();
    const sourceTagInput = publishingSection.getByLabel('文章標籤');
    const sourceClassificationButton = publishingSection.getByRole('button', {
      name: '儲存分類與標籤',
    });
    const [tagBox, buttonBox] = await Promise.all([
      sourceTagInput.boundingBox(),
      sourceClassificationButton.boundingBox(),
    ]);
    expect(tagBox).not.toBeNull();
    expect(buttonBox).not.toBeNull();
    expect(buttonBox!.y).toBeGreaterThanOrEqual(tagBox!.y + tagBox!.height);
    await publishingSection.getByLabel('文章分類').selectOption('legal-practice');
    await sourceTagInput.fill('勞動法、契約');
    await sourceClassificationButton.click();
    await expect(page.getByRole('status')).toContainText('分類與標籤已儲存');

    const publishedSection = page.locator('#published-articles');
    const articleCard = publishedSection.locator('.admin-article-card').first();
    await articleCard.getByRole('button', { name: '編輯分類與標籤' }).click();
    await articleCard.getByLabel('文章分類').selectOption('legal-practice');
    await articleCard.getByLabel('文章標籤').fill('公司法、訴訟');
    await articleCard.getByRole('button', { name: '儲存分類與標籤' }).click();
    await expect(page.getByRole('status')).toContainText('文章分類與標籤已更新');
    await expect(articleCard).toContainText('公司法、訴訟');

    const requests = requestLogs.get(page) || [];
    expect(requests).toContain(`PATCH /api/admin/notion/sources/${activeSource.id}/classification`);
    expect(requests).toContain(`PATCH /api/admin/articles/${publishedArticle.id}/classification`);
    expect(requests).toContain(
      'SOURCE_CLASSIFICATION {"category":"legal-practice","tags":["勞動法","契約"],"expectedWorkingCopyVersion":3}',
    );
    expect(requests).toContain(
      'ARTICLE_CLASSIFICATION {"category":"legal-practice","tags":["公司法","訴訟"]}',
    );
  });

  test('offers immediate publication only and removes scheduling controls', async ({ page }) => {
    await page.getByRole('button', { name: new RegExp(longTitle.slice(0, 12)) }).click();
    await expect(page.getByRole('button', { name: '立即發布', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '排入發布' })).toHaveCount(0);
    await expect(page.getByText(/預定：|排程發布/)).toHaveCount(0);
  });

  test('edits reader-facing categories without exposing the redundant content-type editor', async ({
    page,
  }) => {
    await page.getByRole('button', { name: '文章分類' }).click();
    await expect(page.getByRole('heading', { name: '文章分類', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '內容類型' })).toHaveCount(0);
    await expect(page.getByText('內容類型由系統固定管理')).toBeVisible();

    await page.getByRole('button', { name: /法律實務/ }).click();
    await expect(page.getByLabel('分類網址代稱')).toHaveAttribute('readonly', '');
    await page.getByLabel('分類名稱').fill('法律工作方法');
    await page.getByLabel('分類說明').fill('整理法律工作中的判斷方法與實務觀察。');
    await page.getByLabel('顯示在前台').uncheck();
    const invalidFields = await page.locator('.admin-taxonomy-form').evaluate((form) =>
      Array.from((form as HTMLFormElement).elements)
        .filter(
          (element) =>
            'checkValidity' in element &&
            !(element as HTMLInputElement | HTMLTextAreaElement).checkValidity(),
        )
        .map((element) => (element as HTMLInputElement | HTMLTextAreaElement).id),
    );
    expect(invalidFields).toEqual([]);
    await page.getByRole('button', { name: '儲存分類' }).click();

    await expect(page.getByRole('status')).toContainText('文章分類已儲存');
    await expect(page.getByRole('button', { name: /法律工作方法/ })).toBeVisible();
    const requests = requestLogs.get(page) || [];
    expect(
      requests.some((entry) =>
        entry.includes(
          'TAXONOMY {"kind":"category","value":{"slug":"legal-practice","name":"法律工作方法"',
        ),
      ),
    ).toBe(true);

    await page.getByRole('button', { name: '關閉通知' }).click();
    await page.getByRole('button', { name: '新增分類' }).click();
    await expect(page.getByLabel('分類網址代稱')).not.toHaveAttribute('readonly', '');
    await expect(page.getByRole('button', { name: '儲存分類' })).toBeDisabled();
    await page.getByLabel('分類名稱').fill('案例筆記');
    await page.getByLabel('分類網址代稱').fill('case-notes');
    await page.getByLabel('分類說明').fill('整理案例中的爭點、判斷與可延伸的實務觀察。');
    await page.getByLabel('排序').fill('20');
    await expect(page.getByRole('button', { name: '儲存分類' })).toBeEnabled();
    await page.getByRole('button', { name: '儲存分類' }).click();

    await expect(page.getByRole('status')).toContainText('文章分類已儲存');
    await expect(page.getByRole('button', { name: /案例筆記/ })).toBeVisible();
    expect(
      requests.some((entry) =>
        entry.includes(
          'TAXONOMY {"kind":"category","value":{"slug":"case-notes","name":"案例筆記"',
        ),
      ),
    ).toBe(true);
  });
});
