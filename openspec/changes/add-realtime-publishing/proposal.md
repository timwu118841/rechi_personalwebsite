## Why

目前文章與網站設定儲存在 Git，發布必須等 Vercel 重新建置才能出現在前台，不符合單一作者部落格希望「按下發布就上線」的日常使用方式。這次改為資料庫型即時內容來源，但仍以 Astro 伺服器渲染與 Vercel 邊緣快取維持接近靜態網站的閱讀速度。

## What Changes

- **BREAKING**：將公開內容來源由 Keystatic／Git 檔案改為 Supabase Postgres；發布、下架與編輯不再建立 Git commit 或觸發重新部署。
- 以 Supabase Auth 保護單一作者管理後台，所有管理寫入均由伺服器驗證登入身分後執行。
- 後台新增文章封面圖片上傳、網站標題、網站描述、作者姓名、作者簡介、作者圖片與預設分享圖片設定。
- 公開頁改為 Astro on-demand rendering，並透過 Vercel CDN 標籤快取與後台儲存後失效快取，同時兼顧發布即時性與文章閱讀效能。
- 將 Pagefind 建置期搜尋改為資料庫即時搜尋，使新文章不需部署即可被站內搜尋找到。
- 新增文章列表分頁與可持久化的明暗色模式切換，維持無 JavaScript 時的核心閱讀與 SEO。
- sitemap、RSS、分類、標籤與文章 SEO 資料改為從即時內容來源產生。
- 提供 Supabase schema、RLS、Storage bucket 與既有內容匯入工具，並保留本機 fixture 模式供開發與自動化測試。

## Capabilities

### New Capabilities

- `realtime-content-publishing`: 即時文章生命週期、受保護管理 API、資料庫內容模型、媒體上傳與站內搜尋。
- `site-presentation-settings`: 可由後台調整的網站／作者資訊、文章封面與明暗色模式。
- `dynamic-reading-performance`: 動態公開頁、分頁、Vercel CDN 快取失效與可量測的效能門檻。

### Modified Capabilities

無。原始能力尚未封存為基準規格；本變更以新能力明確取代其 Git／建置期發布假設。

## Impact

- 影響 Astro rendering mode、文章 repository、公開路由、搜尋、RSS／sitemap、管理介面與部署環境驗證。
- 新增 `@supabase/supabase-js` 與安全 Markdown renderer 依賴，移除執行期對 Keystatic 與 Pagefind 的需求。
- 正式環境需要 Supabase URL、publishable key、server secret key、管理者允許清單及公開 Storage bucket。
- 公開頁會使用 Vercel Functions 與 CDN；資料庫或 CDN 暫時異常時以 stale cache 降低讀者影響。
- 不在本變更中建立或部署外部 Supabase／Vercel production 資源；只提供可重複執行的設定與遷移檔。
