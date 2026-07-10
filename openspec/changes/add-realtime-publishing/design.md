## Context

目前網站使用 Astro 靜態輸出、Keystatic Cloud 與 Git 內容檔。這個架構的公開頁很快，但作者每次發布都必須等待 Git 內容變更觸發 Vercel build，Pagefind、RSS 與 sitemap 也只有建置時才更新。作者需要傳統部落格式的即時管理後台，且仍要求公開文章接近靜態頁的載入速度、SEO 完整、單一作者權限清楚。

本變更跨越內容持久化、登入、媒體、管理 API、公開 rendering、搜尋與快取。外部資源建立與 production 部署不在本機實作範圍，但所有 schema、環境設定與匯入步驟必須可重複執行。

## Goals / Non-Goals

**Goals:**

- 作者儲存已發布文章後，不需 commit、build 或 redeploy 即可透過公開網址讀取。
- 保留草稿、排程發布、下架、分類、標籤、內容類型、SEO 與媒體管理能力。
- 讓作者從管理後台調整網站標題、描述、作者姓名／簡介／圖片與預設社群圖片。
- 對公開頁使用 CDN response cache，並在內容變更時精準失效，降低資料庫查詢與 Vercel Function 延遲。
- 新文章立即出現在文章列表、站內搜尋、RSS 與 sitemap。
- 支援封面圖片、文章列表分頁與明暗色模式，核心內容在無 JavaScript 時仍可閱讀。
- 以本機 fixture repository 讓 build、測試與開發不依賴外部 Supabase。

**Non-Goals:**

- 不提供讀者註冊、公開投稿、多作者角色工作流、留言、會員或付費內容。
- 不實作多人協作 rich-text editor；第一版使用可預覽的 Markdown 長文編輯欄位。
- 不在本任務中建立 Supabase project、設定 Vercel production secrets、執行正式遷移或部署。
- 不保證搜尋引擎排名；只確保技術可抓取與即時 discovery artifacts。

## Decisions

### 1. Supabase 作為受管理的內容、登入與媒體後端

以 Supabase Postgres 儲存文章、分類、內容類型與單筆網站設定；Supabase Auth 處理 email/password 登入；Supabase Storage 公開 bucket 儲存封面與作者圖片。公開讀取透過 server-only repository，管理寫入只使用 server secret client。瀏覽器只接觸 URL 與 publishable key，永不取得 secret key。

API 收到 bearer access token 後先以 Auth API 驗證真實使用者，再檢查 `ADMIN_EMAILS` allowlist；通過後才用獨立 server secret client 寫入。資料庫開啟 RLS，匿名角色只能讀取已發布且已到發布時間的文章，其他資料寫入不授權給瀏覽器。

替代方案：保留 Keystatic 但用 webhook build 無法移除發布延遲；Payload 會重建使用者已明確拒絕的重量級 CMS；自行維護 PostgreSQL、Auth 與 object storage 增加維運面。

### 2. 建立 source-independent repository 與 fixture fallback

公開頁、SEO 與管理 API 依賴正規化 `ContentRepository`，不直接散落 Supabase query。當 Supabase 環境變數完整時使用 `SupabaseContentRepository`；本機未設定時使用由既有內容產生的 fixture repository。正式環境驗證器必須拒絕缺少 Supabase secrets 的設定，避免 production 無意間使用示範資料。

repository 提供分頁查詢、slug 查詢、taxonomy 查詢、搜尋、網站設定與管理 CRUD。公開模型不暴露草稿，管理模型才包含完整狀態。

替代方案：直接在每個 Astro route 查詢 Supabase 較快開始，但會讓測試、資料來源切換、權限與查詢條件容易不一致。

### 3. Astro server output 搭配 Vercel CDN route cache

網站切換為 Astro `output: 'server'`。公開頁在 request 時取得最新資料並產生完整 HTML；`@astrojs/vercel/cache` 把文章頁、列表、分類、標籤、RSS 與 sitemap response 快取至 Vercel CDN。頁面設定長 freshness 與 stale-while-revalidate，並加入 `content`、`site-settings`、`article:<slug>` 等 tag。

管理 API 完成文章或設定寫入後，透過 `context.cache.invalidate({ tags })` 軟失效相關 response。下一位讀者仍可立即拿到 CDN 回應，Vercel 在背景重新驗證；為避免已下架文章繼續被命中，更新／下架時也精準失效舊 slug path/tag。開發模式由 Astro 自動把 cache API 視為 no-op。

替代方案：每次請求直查資料庫能保證絕對最新但增加延遲與費用；短 TTL 仍存在固定等待；重新部署違反核心需求。Astro 7 原生 cache API 避免直接耦合 Vercel 私有 helper。

### 4. 動態搜尋與 discovery artifacts

移除 Pagefind 建置期索引。搜尋頁以一般 GET query 呼叫 repository，查詢已發布文章的 title、description、body、分類與 tags，限制結果數並 escape 使用者輸入。RSS 與 sitemap 改成 on-demand endpoint，與其他公開頁共用 content cache tag，因此發布後一併失效。

替代方案：同步第三方搜尋索引增加 webhook、費用與一致性問題；一次把所有全文下載到瀏覽器會隨文章數成長。

### 5. 安全且可攜的 Markdown 文章內容

資料庫儲存 Markdown 原文，公開端以 `marked` 轉換，再由 `sanitize-html` 白名單清理。管理端顯示即時預覽但伺服器永遠重新清理，避免把瀏覽器輸入當可信任 HTML。字數與閱讀時間以移除 Markdown 標記後的純文字計算。

替代方案：儲存 HTML 會增加 XSS 與資料遷移風險；完整 block editor 第一版實作量過大；繼續使用 Markdoc 檔案 loader 不適合資料庫字串。

### 6. 媒體使用唯一 object path 與明確尺寸策略

管理上傳只接受 JPEG、PNG、WebP、AVIF，單檔上限 5 MB，伺服器產生不可變 UUID path 後上傳公開 bucket。文章與作者資料儲存 public URL、alt text、width 與 height；前台設定固定 aspect ratio、intrinsic dimensions、`loading` 與 `fetchpriority`，避免 CLS。更新圖片建立新 path 而非覆寫，避免 CDN 舊檔。

### 7. 明暗色模式採 CSS variables 與早期初始化

預設遵循 `prefers-color-scheme`，使用者切換後寫入 `localStorage`。Base layout 在 CSS 載入前執行極小 inline script 設定 `data-theme`，避免主題閃爍；切換按鈕具備 `aria-pressed` 與可讀標籤。所有顏色沿用 token，不複製整份樣式。

### 8. Query-string 分頁保留穩定 canonical

文章列表每頁 9 篇，使用 `/articles?page=N` 的 server pagination；無效或超出頁碼回到有效範圍／404，並輸出 prev/next link。第一頁 canonical 不帶 `page=1`，其餘頁 canonical 保留頁碼，避免重複內容。分類與標籤列表共用分頁元件。

## Risks / Trade-offs

- [Supabase 或網路異常造成 cache miss 無法渲染] → 使用 CDN stale-while-revalidate、清楚的 server error 與可觀測 log；既有 cache 不因短暫故障立刻消失。
- [Vercel tag invalidation 是 soft invalidation，第一個請求可能短暫收到 stale response] → 寫入後精準失效所有內容 tag；管理後台明示發布已完成，公開端通常在下一次 revalidation 於數秒內更新。敏感下架需求可另加 hard purge，但第一版避免 cache stampede。
- [使用 server secret key 權限過大] → 僅放 server env、獨立 client、先驗證 JWT 與 allowlist、API 不回傳 secret；RLS 作為額外公開讀取界線。
- [公開 Storage bucket 可能被濫用] → 上傳 API 限管理者、限制 MIME／大小、使用不可猜 UUID；不把敏感案件圖片上傳至公開 bucket。
- [資料庫全文 `ilike` 隨大量內容退化] → 初期單人部落格資料量可接受，建立必要索引與結果上限；未來可無痛換成 Postgres FTS 欄位。
- [既有 Markdoc 語法不完全等同 Markdown] → 匯入工具轉換共通語法並產出警告，正式切換前需抽查文章；原 Git 檔保留作為回滾來源。

## Migration Plan

1. 套用 Supabase SQL migration，建立 tables、indexes、RLS、預設設定與 public media bucket。
2. 在 Supabase Auth 建立管理者帳號，將 email 加入 Vercel `ADMIN_EMAILS`，設定 URL、publishable key 與 server secret。
3. 先於 preview 執行既有文章匯入工具，比對文章數、slug、狀態、日期、分類、標籤與內容。
4. 部署 server-output 版本，驗證登入、草稿、發布、下架、圖片、設定、搜尋、分頁、RSS、sitemap 與 cache headers。
5. production 切換後保留原 Git 內容至少一個 release window；若失敗，回滾前一個 Vercel deployment，資料庫內容不刪除。

## Open Questions

- 正式 Supabase project region 應選擇離主要台灣讀者與 Vercel function region 最近的位置；部署前再依帳號可用區域決定。
- 第一版作者圖片與封面直接使用 Supabase CDN；若真實圖片的尺寸／格式差異過大，下一版可加入專用 image transform service。
