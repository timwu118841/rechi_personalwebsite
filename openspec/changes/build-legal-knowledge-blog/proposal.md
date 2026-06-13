## Why

建立一個以閱讀與知識分享為核心的律師個人部落格，讓作者能長期發布家事民事、公司商務、匿名化實務經驗與法律觀點，並透過搜尋引擎取得自然流量。網站需避免傳統律師官網的預約與銷售導向，呈現接近 Medium 的乾淨閱讀體驗。

## What Changes

- 建立 Next.js 與 Payload CMS 整合的單一專案，前台、管理後台與內容 API 共用部署。
- 提供僅限單一管理員登入的視覺化文章編輯後台。
- 支援繁體中文與英文內容；英文內容先建立空白草稿，由作者自行翻譯後發布。
- 提供文章草稿、預覽、手動發布、分類、標籤、封面圖與作者資料管理。
- 建立文章首頁、文章內頁、分類頁、搜尋頁及作者介紹頁。
- 建立技術 SEO：可編輯 metadata、canonical、hreflang、Open Graph、結構化資料、sitemap 與 robots。
- 建立法律內容免責聲明及匿名化內容指引。
- 第一階段不提供預約諮詢、Email 訂閱、會員、追蹤、按讚、留言或自動翻譯。

## Capabilities

### New Capabilities

- `content-authoring`: 單一管理員透過 Payload 後台建立、編輯、預覽與發布雙語法律文章。
- `legal-blog-reading`: 訪客以 Medium 式版面瀏覽、搜尋與閱讀分類化的法律內容。
- `multilingual-content`: 網站介面與內容支援繁體中文及英文版本，且各語言可獨立維護發布狀態。
- `search-engine-visibility`: 每個可索引頁面提供完整技術 SEO、社群分享 metadata 與搜尋引擎探索檔案。

### Modified Capabilities

無。

## Impact

- 新增 Next.js App Router、React、TypeScript、Payload CMS 與 PostgreSQL/Neon 整合。
- 新增 Payload collections、globals、存取控制、文章查詢與前台路由。
- 新增 Vercel 部署設定、環境變數範例與媒體儲存介面。
- 新增 SEO metadata、JSON-LD、sitemap、robots 與雙語 URL 規則。
- 初期可部署於 Vercel Hobby 與 Neon Free；正式商業使用須重新確認代管方案條款。
