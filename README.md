# 法律實務筆記

以 Astro、Supabase 與 Vercel 建立的個人法律經驗部落格。文章、網站標題、作者簡介與圖片可從受保護後台即時更新，不需要為每篇文章重新部署。

## 本機啟動

需要 Node.js 22.12 以上版本。

```bash
cp .env.example .env
npm install
npm run dev
```

- 網站：<http://localhost:4321>
- 管理後台：<http://localhost:4321/admin>

沒有設定 Supabase 時，公開網站會使用 `src/content` 的唯讀示範文章；後台會顯示資料庫設定提示。

## 啟用即時內容後台

1. 建立 Supabase project。
2. 新 Supabase project 可直接在 SQL Editor 執行整合檔 `supabase/all-migrations.sql`；若使用 Supabase CLI，則改為依序執行 `supabase/migrations/` 下的 migration。兩種方式擇一，不要在同一個空間重複執行。
   - 已有部分 migration 的 project 不要直接執行整合檔，請從尚未套用的 migration 接續執行。
3. 在 Supabase Authentication 啟用 Google provider，並將 Google Cloud OAuth redirect URI 設為 `https://<project-ref>.supabase.co/auth/v1/callback`；Supabase Redirect URLs 加入本機與正式站的 `/admin` URL。
4. 將 `.env.example` 的 Supabase 變數填入 `.env`；正式站也要在 Vercel 設定相同環境變數。管理權限不再由部署環境變數控制，而是由 `public.admin_users` 資料表控制。
5. Google 是預設登入方式；相容期可用 `PUBLIC_ADMIN_PASSWORD_LOGIN=true` 保留密碼登入，設為 `false` 即停用。
6. 如需匯入目前的示範文章，執行 `npm run content:import`。

### 管理者安全佈署與增刪

先在 Supabase Authentication 建立並驗證使用者，再以 SQL Editor 使用該使用者 UUID 建立管理成員：

```sql
insert into public.admin_users (user_id, email)
select id, lower(email)
from auth.users
where email = 'admin@example.com'
on conflict (user_id) do update set email = excluded.email, updated_at = now();
```

移除管理權限時刪除 `public.admin_users` 對應列；不要把 `SUPABASE_SECRET_KEY` 或管理成員查詢放進瀏覽器。migration 應先套用、再建立管理列，回滾時保留資料表並先移除成員列。

`SUPABASE_SECRET_KEY` 只能放在本機或 Vercel server environment，不可加上 `PUBLIC_`，也不可放進瀏覽器程式。

## 啟用 Notion 編輯來源

Notion integration 只讀取指定文章資料庫及其中的頁面；同步先建立不可變來源版本，不會直接覆寫公開文章。設定前先完成 Supabase migration 與 Storage 前置條件。

### 1. 建立 Notion internal integration

1. 以 Notion Workspace Owner 開啟 [Creator dashboard](https://www.notion.so/profile/integrations/internal)，在 **Build → Internal connections** 建立 connection。
2. 在 **Configuration** 啟用讀取內容能力。本專案不需要由 integration 寫入 Notion。
3. 複製 **Installation access token**，填入 server-only 的 `NOTION_TOKEN`。不要提交到 Git、加上 `PUBLIC_` 或貼到瀏覽器程式；若外洩，立即在 Notion 重新產生 token。
4. 開啟作為文章來源的 Notion database，從右上角 `•••` 選擇 **Connections → Add connection**，加入剛建立的 connection。未分享給 integration 的 database 無法查詢。Notion 官方步驟見 [Internal connections](https://developers.notion.com/guides/get-started/internal-connections)。

### 2. 建立文章資料庫並取得 Data Source ID

在 Notion 建立文章 database；每一列代表一篇文章，列內頁面正文就是網站文章內容。建議至少保留 `Name` 標題欄位，也可使用 `Slug`、`Tags`、`Description`／`Summary` properties。

在 database 的設定選單開啟 **Manage data sources**，選擇 **Copy data source ID**，將取得的 UUID 填入 `NOTION_DATA_SOURCE_ID`。Database ID 與 Data Source ID 不可互換；本專案使用 `POST /v1/data_sources/{data_source_id}/query` 列出文章頁面。詳見 [Query a data source](https://developers.notion.com/reference/query-a-data-source)。

### 3. 設定環境變數

| 變數                              | 放置位置                   | 用途                                                                  |
| --------------------------------- | -------------------------- | --------------------------------------------------------------------- |
| `PUBLIC_SUPABASE_URL`             | 本機、Vercel；可送到瀏覽器 | Supabase project URL                                                  |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 本機、Vercel；可送到瀏覽器 | Supabase publishable key                                              |
| `SUPABASE_SECRET_KEY`             | 僅 server environment      | 後台、worker 與 Storage 的高權限 key                                  |
| `CRON_SECRET`                     | 僅 server environment      | 保護 `/api/internal/content-worker`；使用至少 16 字元的隨機值         |
| `NOTION_EDITORIAL_ENABLED`        | server environment         | 啟用 Notion editorial pipeline 時必須設為 `true`                      |
| `NOTION_TOKEN`                    | 僅 server environment      | 使用者提供的 Notion internal integration secret／API key              |
| `NOTION_DATA_SOURCE_ID`           | server environment         | 已分享給 integration 的文章 database 對應 Data Source UUID            |
| `NOTION_VERSION`                  | server environment         | 必須固定為 `2026-03-11`；request header 也由 adapter 常數固定為此版本 |
| `CONTENT_PUBLIC_READ_MODE`        | server environment         | 保留值 `service`／`publishable`；目前沒有作用中的切換 call site       |
| `NOTION_PUBLICATION_MODE`         | server environment         | 保留值 `legacy`／`shadow`／`notion`；目前沒有作用中的切換 call site   |

啟用前至少要提供 `PUBLIC_SUPABASE_URL`、`PUBLIC_SUPABASE_PUBLISHABLE_KEY`、`SUPABASE_SECRET_KEY`、`CRON_SECRET`、`NOTION_TOKEN`、`NOTION_DATA_SOURCE_ID`，並設定 `NOTION_EDITORIAL_ENABLED=true`、`NOTION_VERSION=2026-03-11`。`CONTENT_PUBLIC_READ_MODE` 與 `NOTION_PUBLICATION_MODE` 是保留的 rollout 設定；部署時維持 `.env.example` 的 `service` 與 `legacy`，不要假設只修改這兩個值就會切換公開來源。

### 4. Cron 與 Storage 前置條件

- 依序套用全部 migration，包含 `supabase/migrations/202607150001_notion_content_pipeline.sql` 與其後的 `supabase/migrations/202607150002_enqueue_content_job_rpc.sql`。前者建立內容工作佇列、審查資料表與 private `notion-staging` bucket；後者提供 partial-index-safe 的 durable job enqueue RPC。
- `vercel.json` 每天以 GET 呼叫 `/api/internal/content-worker`（`0 0 * * *`，UTC 00:00／台灣時間 08:00；Hobby 方案可能在該小時內觸發）。在 Vercel Production 設定 `CRON_SECRET` 後，Vercel 會自動送出 `Authorization: Bearer <CRON_SECRET>`；端點缺少或不符合時回應 `503` 或 `401`。詳見 [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)。
- 每輪 worker 最多 claim 及處理 5 個 `sync_root`、`sync_source` 或 `finalize_candidate` jobs；管理員從後台按下同步時會立即觸發一次 worker，Vercel Cron 則作為每日備援，資料庫列數較多時後續執行會繼續清空佇列。`sync_root` 是相容既有佇列的內部工作名稱，實際同步目標已是 Data Source。
- 確認目標 Supabase project 已啟用 Storage，且全域檔案上限至少 25 MB；bucket 上限不能高於全域上限。
- `notion-staging` 是 private bucket，上限 25 MB；`site-media` 是公開 bucket，上限 5 MB。公開 bucket 的 URL 可由任何取得網址的人讀取，不得存放敏感案件資料。
- migration 只建立 bucket metadata；仍須在目標 project 檢查 bucket、RLS 與 service key 權限。Supabase Storage 的 private/public 行為與限制見 [Storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) 與 [file limits](https://supabase.com/docs/guides/storage/uploads/file-limits)。

### 5. 同步與發布流程

1. 在 `/admin` 的 **Notion 同步**按下 **同步文章資料庫**，排入 discovery job 並立即執行 worker；也可以貼上單一 page ID，只同步指定資料列頁面。
2. Database sync 使用 `NOTION_DATA_SOURCE_ID` 查詢全部資料列，支援 Notion cursor pagination，並為新增或已變更的文章頁面排入 `sync_source` job；未變更的資料列不會重複同步。
3. 每個 source job 以 `Notion-Version: 2026-03-11` 讀取該頁 properties 與頁內遞迴 block tree，建立或更新 source、不可變 revision 與 working copy。同步本身不會改變目前公開文章。
4. 頁面含圖片時，worker 會先下載並驗證，再以內容 digest 產生穩定路徑、promotion 到公開 `site-media`，最後把 working copy 中的 logical asset reference 換成公開 URL；任何必要圖片失敗時，整個 source job 失敗，不會留下部分完成的 working copy。
5. 建立發布候選並檢查預覽；候選必須分別通過隱私與法律審查。
6. 按下立即發布後，worker 會立刻重新讀取 Notion、下載圖片並比對來源及媒體 hash；內容已變更或頁面已移到垃圾桶時會取消舊候選，不會發布過期版本。後台不提供排程發布。

每輪 worker 最多處理 5 個 jobs。資料庫 discovery 本身也算一個 job；若 database 有多筆資料列，立即執行最多先處理 5 個，剩餘工作會由下一次手動同步或每日 Cron 繼續處理。一般單頁同步不需要等待 Cron。

### 圖片與內容限制

- 目前轉換器只接受 paragraph、heading 1–3、bulleted/numbered list、quote、code、divider 與 image block；遇到 table、file、PDF block、mention、equation 或不安全連結時，整個 revision 會失敗，不會部分發布。
- image block 只接受 Notion-hosted file；caption 會成為圖片替代文字。Notion-hosted 短期下載網址只用於抓取，不會直接存進公開文章。
- worker 只接受 Notion API 回傳的 `s3.us-west-2.amazonaws.com/secure.notion-static.com/` 圖片 URL，不接受外部圖片網域；下載 timeout 為 10 秒。
- 圖片只接受 JPEG、PNG、WebP、AVIF，必須介於 1 byte 與 5 MB，且回應 `Content-Type` 必須和實際檔案 signature 相符。驗證成功後才 promotion 到公開 `site-media`。
- `notion-staging` 仍是 migration 建立的 private bucket；目前 source sync 的已驗證圖片會直接以 digest-based path promotion 到 `site-media`，並在媒體資料表記錄狀態與公開路徑。
- 既有後台直接上傳使用公開 `site-media` bucket，只接受 JPEG、PNG、WebP、AVIF，單檔最多 5 MB。

`npm run deploy:validate` 只檢查本機程序收到的變數和值格式，不會連線驗證遠端 Notion、Vercel 或 Supabase。

## 常用指令

```bash
npm run dev              # 開發伺服器
npm run build            # 建立 Vercel server output
npm run quality          # format、lint、型別、測試與 build
npm run test:e2e         # 瀏覽器測試
npm run deploy:validate  # 驗證正式環境變數
```

正式部署前的操作順序與回滾方式請見 `docs/release-checklist.md`。

## 免責聲明

本站內容僅為一般資訊與個人經驗分享，不構成針對特定個案的法律意見。
