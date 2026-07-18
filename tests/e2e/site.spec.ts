import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { articlePath as buildArticlePath } from '@/lib/content/slug';

const welcomeArticlePath = '/articles/welcome/';
const unicodeArticleSlug = '中文網址代稱測試';
const unicodeArticleTitle = '中文網址代稱測試文章';
const encodedUnicodeArticlePath = buildArticlePath(unicodeArticleSlug);
const rawUnicodeArticlePath = `/articles/${unicodeArticleSlug}/`;

test.describe('公開即時閱讀體驗', () => {
  test('首頁、文章、封面與主要探索路徑可使用', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('法律經驗');
    await expect(page.getByRole('link', { name: /開始閱讀/ })).toHaveAttribute(
      'href',
      '/articles/',
    );
    await expect(page.locator('.article-card').first().locator('.default-artwork')).toBeVisible();

    await page.goto(welcomeArticlePath);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.article-header .eyebrow')).toHaveText('法律文章 · 法律實務');
    await expect(page.getByText(/不構成針對任何個案的法律意見/)).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https?:\/\//);
    const structuredData = await page.locator('script[type="application/ld+json"]').textContent();
    expect(structuredData).toContain('BlogPosting');
    const publicScripts = await page
      .locator('script[src]')
      .evaluateAll((scripts) => scripts.map((script) => script.getAttribute('src') || ''));
    expect(publicScripts.join(' ')).not.toMatch(/AdminApp|react\./);
  });

  test('草稿與無效分頁不會形成公開內容', async ({ request }) => {
    const draft = await request.get('/articles/private-draft/');
    expect(draft.status()).toBe(404);
    expect(await draft.text()).not.toContain('尚未公開的草稿');
    const invalidPage = await request.get('/articles/?page=0');
    expect(invalidPage.status()).toBe(404);
  });

  test('分類由內容設定產生且隱藏分類不出現', async ({ page }) => {
    await page.goto('/categories/');
    await expect(page.locator('a[href="/categories/legal-practice/"]')).toBeVisible();
    await expect(page.getByText('從契約、爭議與日常法律工作中')).toBeVisible();
    await expect(page.getByText('測試內容')).toHaveCount(0);
    await page.goto('/categories/legal-practice/');
    await expect(page.getByRole('heading', { level: 1, name: '法律實務' })).toBeVisible();
  });

  test('站內搜尋在伺服器即時查詢已發布內容', async ({ page }) => {
    await page.goto('/search/');
    await page.getByRole('searchbox', { name: '搜尋文章' }).fill('契約');
    await page.getByRole('button', { name: '搜尋' }).click();
    await expect(page).toHaveURL(/q=%E5%A5%91%E7%B4%84/);
    await expect(page.getByText(/找到 \d+ 筆結果/)).toBeVisible();
    await expect(page.locator('.search-results')).not.toContainText('尚未公開的草稿');
    await expect(page.locator('.search-results a').first()).toBeVisible();
  });

  test('無空白的長摘要不會撐破文章卡片', async ({ page }) => {
    await page.goto('/articles/');
    const card = page.locator('.article-card').first();
    const summary = card.locator('p');
    await summary.evaluate((element) => {
      element.textContent = 'test'.repeat(120);
    });
    expect(await card.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await summary.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    await expect(summary).toHaveCSS('overflow-wrap', 'anywhere');
  });

  test('Dark Mode 可切換、持久化且按鈕狀態可存取', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('.theme-toggle:visible').first();
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('預設圖片尺寸、Header 工具間距與雙主題配色保持舒適', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/');

    const artwork = page.locator('.article-card-featured .default-artwork');
    await expect(artwork).toBeVisible();
    const lightBackground = await artwork.evaluate(
      (element) => getComputedStyle(element).backgroundImage,
    );
    const artworkBox = await artwork.boundingBox();
    expect(artworkBox?.height).toBeLessThanOrEqual(340);

    const search = page.locator('.site-nav .search-link');
    const toggle = page.locator('.site-nav .theme-toggle');
    const [searchBox, toggleBox] = await Promise.all([search.boundingBox(), toggle.boundingBox()]);
    expect(
      (toggleBox?.x || 0) - ((searchBox?.x || 0) + (searchBox?.width || 0)),
    ).toBeGreaterThanOrEqual(12);

    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const darkBackground = await artwork.evaluate(
      (element) => getComputedStyle(element).backgroundImage,
    );
    expect(darkBackground).not.toBe(lightBackground);

    await page.goto(welcomeArticlePath);
    await expect(page.locator('.article-cover')).toHaveCount(0);

    const prose = page.locator('.prose');
    await prose.evaluate((element) => {
      element.insertAdjacentHTML(
        'afterbegin',
        '<img data-testid="article-body-image" width="1200" height="630" alt="版面測試圖片" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221200%22 height=%22630%22%3E%3Crect width=%221200%22 height=%22630%22 fill=%22%23ddd%22/%3E%3C/svg%3E" />',
      );
    });
    const bodyImageBox = await page.getByTestId('article-body-image').boundingBox();
    expect(bodyImageBox?.width).toBeLessThanOrEqual(608);
  });

  test('首頁文章卡片圖片等高對齊且裝飾線不與文字重疊', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/');

    const artworkLinks = page.locator('.article-card:not(.article-card-featured) .card-image');
    const boxes = await artworkLinks.evaluateAll((elements) =>
      elements.slice(0, 3).map((element) => {
        const box = element.getBoundingClientRect();
        return { y: box.y, height: box.height };
      }),
    );
    expect(boxes).toHaveLength(3);
    expect(
      Math.max(...boxes.map((box) => box.y)) - Math.min(...boxes.map((box) => box.y)),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.max(...boxes.map((box) => box.height)) - Math.min(...boxes.map((box) => box.height)),
    ).toBeLessThanOrEqual(1);

    const firstArtwork = artworkLinks.first();
    await expect(firstArtwork).toHaveCSS('text-decoration-line', 'none');
    expect(
      await firstArtwork
        .locator('.default-artwork')
        .evaluate((element) => getComputedStyle(element, '::after').borderTopWidth),
    ).toBe('0px');
    const [copyBox, ruleBox] = await Promise.all([
      firstArtwork.locator('.default-artwork-copy').boundingBox(),
      firstArtwork.locator('.default-artwork-rule').boundingBox(),
    ]);
    expect((ruleBox?.y || 0) - ((copyBox?.y || 0) + (copyBox?.height || 0))).toBeGreaterThanOrEqual(
      8,
    );
  });

  test('文章分享列與頁尾之間保留清楚的收尾留白', async ({ page }) => {
    await page.goto(welcomeArticlePath);
    const [shareBox, footerBox] = await Promise.all([
      page.locator('.share-row').boundingBox(),
      page.locator('.site-footer').boundingBox(),
    ]);
    const spacing = (footerBox?.y || 0) - ((shareBox?.y || 0) + (shareBox?.height || 0));
    expect(spacing).toBeGreaterThanOrEqual(64);
  });

  test('未設定 Supabase 時後台清楚顯示設定提示且 API 拒絕匿名存取', async ({ page, request }) => {
    await page.goto('/admin/');
    await expect(
      page.getByRole('heading', { name: /管理後台尚未連接資料庫|內容管理登入/ }),
    ).toBeVisible();
    const response = await request.get('/api/admin/articles');
    expect([401, 503]).toContain(response.status());
    expect(response.headers()['cache-control']).toContain('no-store');
  });

  test('核心頁面沒有嚴重自動化無障礙問題', async ({ page }) => {
    for (const path of ['/', welcomeArticlePath, '/search/']) {
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

  test('公開核心頁面在手機寬度沒有橫向溢位', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    for (const path of [
      '/',
      '/articles/',
      welcomeArticlePath,
      '/categories/',
      '/tags/',
      '/search/',
      '/about/',
    ]) {
      await page.goto(path);
      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(hasHorizontalOverflow, `${path} 不應產生橫向捲動`).toBe(false);
    }
  });

  test('文章長標題在 200% 縮放下完整換行且不撐破版面', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 900 });
    await page.goto(welcomeArticlePath);
    const heading = page.locator('.article-header h1');
    await heading.evaluate((element) => {
      element.textContent =
        '這是一個用來驗證法律實務文章超長標題在高倍率縮放與窄版閱讀情境下仍能完整換行的測試標題';
      document.documentElement.style.zoom = '2';
    });

    await expect(heading).toBeVisible();
    expect(await heading.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
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
    await page.goto(welcomeArticlePath);
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

test('encoded 中文 article URL returns 200 and renders the title', async ({ page, request }) => {
  const response = await request.get(encodedUnicodeArticlePath);
  expect(response.status()).toBe(200);
  const cacheTag = response.headers()['vercel-cache-tag'];
  expect(cacheTag).toContain(`article:${encodeURIComponent(unicodeArticleSlug)}`);
  expect(cacheTag).not.toContain(unicodeArticleSlug);
  expect([...cacheTag].every((character) => character.codePointAt(0)! <= 0x7f)).toBe(true);

  await page.goto(encodedUnicodeArticlePath);
  await expect(page.getByRole('heading', { level: 1, name: unicodeArticleTitle })).toBeVisible();
});

test('直接 Unicode 中文 article URL 也可正常開啟', async ({ page }) => {
  await page.goto(rawUnicodeArticlePath);
  await expect(page.getByRole('heading', { level: 1, name: unicodeArticleTitle })).toBeVisible();
});

test('停用 JavaScript 時仍能導覽、搜尋與閱讀全文', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', '單一瀏覽器即可驗證無 JavaScript 契約');
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/search/?q=%E5%A5%91%E7%B4%84');
  await expect(page.locator('.search-results a').first()).toBeVisible();
  await page.goto('/articles/');
  await page.locator('article h3 a').first().click();
  await expect(page.locator('.prose')).toBeVisible();
  await expect(page.locator('.prose')).not.toBeEmpty();
  await context.close();
});

test('SEO 發現檔即時產生且不洩漏草稿', async ({ request }) => {
  for (const path of ['/robots.txt', '/rss.xml', '/sitemap.xml']) {
    const response = await request.get(path);
    expect(response.ok(), `${path} 應成功`).toBe(true);
    expect(await response.text()).not.toContain('private-draft');
  }
});
