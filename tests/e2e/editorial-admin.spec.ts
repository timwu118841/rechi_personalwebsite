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

test.describe('受保護的 Notion 編輯發布後台', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    let candidate = {
      ...activeCandidate,
      state: testInfo.title.includes('ready_to_activate')
        ? 'ready_to_activate'
        : activeCandidate.state,
    };
    let publishRequested = false;
    const requests: string[] = [];
    requestLogs.set(page, requests);
    await page.route('**/api/admin/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      requests.push(`${request.method()} ${url.pathname}${url.search}`);
      let body: unknown;
      if (url.pathname === '/api/admin/articles') body = { articles: [] };
      else if (url.pathname === '/api/admin/settings')
        body = { settings: { shortTitle: '測試站' } };
      else if (url.pathname === '/api/admin/taxonomies')
        body = { categories: [], contentTypes: [] };
      else if (url.pathname === '/api/admin/notion/sources') body = { sources: [] };
      else if (url.pathname === '/api/admin/notion/candidates') {
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
        candidate = testInfo.title.includes('media failure')
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
      } else if (url.pathname === `/api/admin/notion/jobs/${jobId}`) {
        body = {
          job: {
            id: jobId,
            candidate_id: testInfo.title.includes('mismatched job')
              ? 'different-candidate'
              : candidateId,
            state: 'succeeded',
          },
        };
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
});
