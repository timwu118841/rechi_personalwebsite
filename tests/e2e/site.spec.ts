import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const articlePath = '/articles/welcome/';

test.describe('公開閱讀體驗', () => {
  test('首頁、文章與主要探索路徑可使用', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('法律經驗');
    const primaryNavigation = page.locator('.site-nav');
    if (await primaryNavigation.isVisible()) {
      await expect(primaryNavigation).toBeVisible();
    } else {
      await page.getByText('選單', { exact: true }).click();
      await expect(page.getByRole('navigation', { name: '行動版導覽' })).toBeVisible();
    }
    await expect(page.getByRole('link', { name: /開始閱讀/ })).toHaveAttribute(
      'href',
      '/articles/',
    );

    await page.goto(articlePath);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.article-header .eyebrow')).toHaveText('法律文章 · 法律實務');
    await expect(page.getByText(/不構成針對任何個案的法律意見/)).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https?:\/\//);
  });

  test('草稿不會形成公開路由', async ({ request }) => {
    const response = await request.get('/articles/private-draft/');
    expect(response.status()).toBe(404);
    expect(await response.text()).not.toContain('尚未公開的草稿');
  });

  test('後台管理的可見分類會依設定顯示', async ({ page }) => {
    await page.goto('/categories/');
    await expect(page.locator('a[href="/categories/legal-practice/"]')).toBeVisible();
    await expect(page.getByText('從契約、爭議與日常法律工作中')).toBeVisible();
    await expect(page.getByText('測試內容')).toHaveCount(0);

    await page.goto('/categories/legal-practice/');
    await expect(page.getByRole('heading', { level: 1, name: '法律實務' })).toBeVisible();
  });

  test('搜尋索引只回傳已發布內容', async ({ page }) => {
    await page.goto('/search/');
    await page.getByRole('searchbox', { name: '搜尋文章' }).fill('契約');
    await page.getByRole('button', { name: '搜尋' }).click();
    await expect(page.getByText(/找到 \d+ 筆結果/)).toBeVisible();
    await expect(page.locator('#search-results')).not.toContainText('尚未公開的草稿');
    await expect(page.locator('#search-results a').first()).toBeVisible();
  });

  test('核心頁面沒有嚴重自動化無障礙問題', async ({ page }) => {
    for (const path of ['/', articlePath, '/search/']) {
      await page.goto(path);
      const result = await new AxeBuilder({ page }).analyze();
      expect(result.violations, `${path} 的 axe violations`).toEqual([]);
    }
  });

  test('鍵盤焦點、200% 縮放與行動導覽仍可操作', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: '跳到主要內容' })).toBeFocused();
    await page.getByRole('link', { name: '跳到主要內容' }).press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();

    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const menu = page.getByText('選單', { exact: true });
    if (await menu.isVisible()) {
      await menu.click();
      await expect(page.locator('.mobile-nav').getByRole('link', { name: '文章' })).toBeVisible();
    }
  });

  test('分析被封鎖或收到多餘欄位時不影響閱讀且不送出敏感資料', async ({ page }) => {
    await page.route('**/script.js', (route) => route.abort());
    await page.addInitScript(() => {
      const calls: unknown[] = [];
      Object.assign(window, {
        __analyticsCalls: calls,
        umami: { track: (...args: unknown[]) => calls.push(args) },
      });
    });
    await page.goto(articlePath);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.evaluate(() => {
      const analyticsWindow = window as typeof window & {
        blogAnalytics?: { track: (name: string, data: Record<string, unknown>) => void };
      };
      analyticsWindow.blogAnalytics?.track('site_search', {
        resultCount: 2,
        query: '不應送出的姓名與案號',
        email: 'reader@example.com',
      });
    });
    const calls = await page.evaluate(
      () => (window as typeof window & { __analyticsCalls?: unknown[] }).__analyticsCalls,
    );
    expect(JSON.stringify(calls)).not.toContain('不應送出');
    expect(JSON.stringify(calls)).not.toContain('reader@example.com');
  });
});

test('停用 JavaScript 時仍能導覽與閱讀全文', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', '單一瀏覽器即可驗證無 JavaScript 契約');
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('link', { name: /開始閱讀/ }).click();
  await expect(page).toHaveURL(/\/articles\/$/);
  await page.locator('article a').first().click();
  await expect(page.locator('.prose')).toBeVisible();
  await expect(page.locator('.prose')).not.toBeEmpty();
  await context.close();
});

test('SEO 發現檔存在且不洩漏草稿', async ({ request }) => {
  for (const path of ['/robots.txt', '/rss.xml', '/sitemap-index.xml']) {
    const response = await request.get(path);
    expect(response.ok(), `${path} 應成功`).toBe(true);
    expect(await response.text()).not.toContain('private-draft');
  }
});
