# Homepage Hero Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓管理員可在 Payload「網站設定」分別修改中英文首頁主標題。

**Architecture:** 在既有 `SiteSettings` global 新增本地化 `homepageHeroTitle` 欄位，首頁從已取得的 settings 優先讀取該值，空值回退至翻譯檔。Payload 型別重新產生，不新增資料轉換層或套件。

**Tech Stack:** Next.js 16、Payload CMS 3.85、TypeScript、Vitest、OpenSpec

---

### Task 1: 鎖定後台欄位契約

**Files:**
- Modify: `tests/int/blog-admin-config.int.spec.ts`
- Modify: `src/globals/SiteSettings.ts`

- [ ] **Step 1: 寫入失敗測試**

新增測試，遞迴尋找 `SiteSettings.fields` 中的 `homepageHeroTitle`，並確認 `localized: true`、中文標籤為「首頁主標題」。

- [ ] **Step 2: 驗證測試因欄位不存在而失敗**

Run: `npm run test:int -- tests/int/blog-admin-config.int.spec.ts`

- [ ] **Step 3: 新增最小欄位設定**

在 `tagline` 後新增本地化文字欄位：

```ts
{
  name: 'homepageHeroTitle',
  label: { 'zh-TW': '首頁主標題', en: 'Homepage hero title' },
  type: 'text',
  localized: true,
}
```

- [ ] **Step 4: 驗證設定測試通過**

Run: `npm run test:int -- tests/int/blog-admin-config.int.spec.ts`

### Task 2: 首頁讀取設定值並保留回退

**Files:**
- Modify: `tests/int/blog-homepage.int.spec.ts`
- Modify: `src/app/(frontend)/[locale]/page.tsx`

- [ ] **Step 1: 寫入失敗測試**

設定 `getSiteSettings` 回傳 `homepageHeroTitle: '後台設定的首頁標題'`，確認首頁輸出此值且不輸出原始預設標題。

- [ ] **Step 2: 驗證測試失敗**

Run: `npm run test:int -- tests/int/blog-homepage.int.spec.ts`

- [ ] **Step 3: 實作設定優先、翻譯回退**

將首頁主標題改為：

```tsx
<h1>{settings?.homepageHeroTitle || t.heroTitle}</h1>
```

- [ ] **Step 4: 補上空值回退測試並驗證通過**

Run: `npm run test:int -- tests/int/blog-homepage.int.spec.ts`

### Task 3: 產物與完整驗證

**Files:**
- Modify: `src/payload-types.ts`
- Modify: `src/app/(payload)/admin/importMap.js`（僅在產生器需要時）

- [ ] **Step 1: 重新產生 Payload 型別與 import map**

Run: `npm run generate:types && npm run generate:importmap`

- [ ] **Step 2: 執行完整驗證**

Run:

```bash
npm run test:int
npx tsc --noEmit
npm run lint
npm run build
openspec validate manage-homepage-hero-title --type change --strict --no-interactive
git diff --check
```

- [ ] **Step 3: 依 Lore Commit Protocol 提交**

提交欄位、首頁讀取、測試、型別與 OpenSpec artifacts。
