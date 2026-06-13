## Context

目前專案只有 OpenSpec 設定，尚無應用程式。網站定位為單一律師作者的專業知識部落格，內容涵蓋家事民事、公司商務、匿名化案例／執業經驗及法律觀點。訪客來自全台灣，主要透過搜尋引擎進站；產品體驗以 Medium 式長文閱讀為核心，不設預約或銷售漏斗。

部署目標為 Vercel 與代管 PostgreSQL（初期 Neon Free）。Payload CMS 與 Next.js 必須在同一程式庫內運作，避免另建自製 API、驗證系統與管理後台。

## Goals / Non-Goals

**Goals:**

- 建立可在本機啟動並能部署至 Vercel 的 Next.js＋Payload CMS 專案。
- 提供單一管理員使用的視覺化文章後台、媒體庫、草稿與預覽。
- 以繁中為預設語言，英文為獨立維護的翻譯版本。
- 提供首頁、文章、分類、搜尋及作者介紹等閱讀路徑。
- 讓搜尋引擎正確理解文章語言、作者、分類、發布時間與修改時間。
- 保持資料模型及元件邊界簡單，便於未來調整品牌與視覺。

**Non-Goals:**

- 不提供預約、案件諮詢表單、會員、留言、按讚、追蹤或電子報。
- 不串接 AI 翻譯；英文內容由後台空白草稿開始。
- 不實作多作者、編輯審核流程或排程發布。
- 不在第一階段建立完整品牌識別、Logo 或正式律師照片。
- 不保證特定關鍵字排名；僅提供可被索引及利於內容 SEO 的技術基礎。

## Decisions

### 1. 採用單體式 Next.js＋Payload CMS

Next.js App Router 同時承載公開頁面、Payload Admin、REST API 與 GraphQL API。這能共享型別、內容查詢及部署流程。

替代方案是自製 NestJS 後端與管理介面，但會重複建置登入、權限、富文字編輯、媒體與草稿機制，對單一作者部落格不具成本效益。

### 2. 採用 PostgreSQL 與 Payload Postgres adapter

正式環境以 `DATABASE_URI` 連接 Neon PostgreSQL。本機可使用相同 PostgreSQL 連線，確保開發與正式環境一致。

替代方案是 SQLite，但 Payload 在 serverless 部署下需要持久且可由多個執行個體存取的資料庫，因此不採用。

### 3. 使用欄位式 localization

Payload 設定 `zh-Hant` 與 `en`，文章標題、摘要、內文、slug 與 SEO 欄位皆為 localized。前台 URL 採 `/{locale}/...`，例如 `/zh-Hant/posts/example` 與 `/en/posts/example`。

英文空白草稿不應回退顯示繁中內容；公開查詢使用 `fallbackLocale: false`。只有該語言具完整內容且文章為已發布狀態時，該 URL 才可索引。

### 4. 以 Payload collections/globals 定義內容邊界

- `users`：僅管理員帳號，可登入後台。
- `posts`：文章、語系內容、狀態、分類、標籤、封面與 SEO。
- `categories`：家事民事、公司商務、案例與經驗、法律觀點。
- `media`：圖片與替代文字。
- `site-settings`：網站名稱、作者簡介、預設 SEO 與免責聲明。

公開讀取僅回傳已發布內容；建立、修改及刪除要求已登入管理員。

### 5. 閱讀頁面優先採 Server Components

公開頁面在伺服器查詢 Payload Local API，文章內容以 Lexical renderer 輸出。互動式功能僅限語言切換與搜尋輸入，降低前端 JavaScript。

首頁顯示精選文章及最新文章；文章頁採窄欄長文、閱讀時間、作者、日期、分類、免責聲明及相關文章。

### 6. 站內搜尋先使用 PostgreSQL 模糊查詢

搜尋範圍為目前語言的標題與摘要，依發布日期排序。第一階段不導入 Algolia、Elasticsearch 或向量搜尋，以避免外部成本與同步複雜度。

### 7. SEO 採每頁明確輸出

Next.js Metadata API 產生 title、description、canonical、language alternates 與 Open Graph。文章頁額外輸出 `Article` JSON-LD；作者頁輸出 `Person` JSON-LD。`sitemap.ts` 僅列出已發布語系版本，`robots.ts` 禁止索引 `/admin` 與 API 路徑。

文章模型提供 SEO title、description、分享圖片及 `noIndex`；未填寫時使用文章標題、摘要與封面回退。

### 8. 媒體儲存保留 provider 邊界

本機開發使用 Payload 本機媒體目錄；Vercel 正式環境透過 S3 相容 adapter 或 Vercel Blob。第一階段先完成 media collection 與環境變數介面，實際 provider 可在部署時選定。

### 9. 法律內容安全

文章頁固定顯示「一般性資訊、不構成個案法律意見或委任關係」聲明。後台文章另有「已確認匿名化」欄位，文章發布前必須勾選，避免直接揭露可識別個案資訊。

## Risks / Trade-offs

- [Vercel Hobby 限個人非商業用途] → 初期僅作個人知識分享；若轉為業務招攬或商業用途，部署前升級合適方案。
- [Neon Free 會休眠且容量有限] → 接受首次連線延遲；流量或資料量增加時升級。
- [Payload localization 為欄位層級] → 公開查詢停用語言 fallback，避免英文頁誤顯繁中。
- [Vercel 無持久本機檔案系統] → 正式環境不得使用本機上傳目錄，改接物件儲存。
- [法律內容可能涉及個資或誤解為法律意見] → 發布前匿名化確認，前台固定免責聲明。
- [站內模糊搜尋能力有限] → 初期內容量小可接受，未來再以專用搜尋服務替換。
- [SEO 不等於排名保證] → 提供技術基礎與內容欄位，排名仍取決於內容品質、競爭與時間。

## Migration Plan

1. 初始化專案、資料模型及本機 PostgreSQL。
2. 建立第一位管理員並新增預設分類與網站設定。
3. 在 Vercel 建立專案，設定 Payload secret、資料庫與正式網址。
4. 建立 Neon production database 並執行 schema migration。
5. 設定媒體物件儲存與環境變數。
6. 部署 preview，驗證登入、發文、雙語、metadata、sitemap 與 robots。
7. 綁定網域後發布 production。

回滾時保留前一版 Vercel deployment，並在資料模型 migration 前建立 Neon restore point。

## Open Questions

- 正式網域、網站名稱、律師姓名、品牌素材及作者照片留待後續設定。
- 正式媒體 provider 在部署前於 Vercel Blob 與 S3 相容服務中擇一。
