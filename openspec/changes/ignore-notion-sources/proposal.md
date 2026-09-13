## Why

Notion 同步以 data source 為單位：只要資料庫裡還有那一列，discovery 就會把它列進同步計畫，後台「資料庫文章來源」清單因此只增不減。對不需要的頁面（未完成的草稿、非文章頁、重複建立的頁面），作者目前沒有任何手段讓它離開流程——它會持續佔用清單、進入同步與候選流程，每日 cron 也會一再處理。

## What Changes

- 新增**忽略來源**（軟刪除）：來源加上 `ignored_at` 標記，從同步計畫中排除，不再產生新的 job、revision 或發布候選；可一鍵復原。
- 忽略時取消該來源排隊中的 content job，以及尚未上線的發布候選（`prepared`／`publishing`／`media_failed`／`ready_to_activate`）。
- **已發布文章不受影響**：忽略只停止同步，不等於下架；下架仍走既有的 `unpublish_article`。
- 資料庫層在 `prepare_publication_candidate` 拒絕為已忽略來源建立候選，與既有的 `state` 檢查放在同一個邊界。
- 後台來源清單提供單筆與批次（勾選多列）的忽略／復原操作，並可切換檢視已忽略來源。
- 新增 `set_article_sources_ignored(uuid[], boolean, uuid)` RPC，寫入 `content_audit_log` 審計記錄。

## Capabilities

### New Capabilities

- `notion-source-retirement`: 已同步 Notion 來源的忽略、復原、同步排除、發布邊界與批次操作。

### Modified Capabilities

無。此變更只在既有 pipeline 之上增加一個來源生命週期狀態，不改動已發布內容的公開行為。

## Impact

- 新增 migration `202609130001_ignore_article_sources.sql`，並同步更新 `supabase/all-migrations.sql` 整合檔（parity 驗證要求逐一對應）。
- 影響 `article_sources` schema、`prepare_publication_candidate` RPC、content job 錯誤對應、admin API 與 `/admin` 來源清單 UI。
- 公開前台、RSS／sitemap／搜尋不受影響：來源本身非公開資料，已發布文章在忽略後仍維持原狀。
- 不提供硬刪除：`article_source_revisions`、`article_working_copies`、`publication_candidates` 以 `on delete restrict` 綁定來源，硬刪除會破壞審計與可復原性；本變更刻意不做。
