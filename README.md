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
3. 完成 Google 登入設定：Google Cloud 的 OAuth 用戶端 + Supabase 的 Google provider 與 Redirect URLs，步驟見下方「Google 登入設定」。
4. 將 `.env.example` 的 Supabase 變數填入 `.env`；正式站也要在 Vercel 設定相同環境變數。管理權限不再由部署環境變數控制，而是由 `public.admin_users` 資料表控制。
5. 登入只用 Google：登入頁只有「使用 Google 登入」按鈕，沒有帳號密碼欄位；`/api/admin/*` 也會拒絕以 Supabase `email` provider 取得的 session。
6. 如需匯入目前的示範文章，執行 `npm run content:import`。

### Google 登入設定

Google 登入要三個地方的設定一致：Google Cloud 的 OAuth 用戶端、Supabase 專案的 provider 與網址允許清單、本機 stack（`supabase/config.toml`）。

#### 1. Google Cloud Console

1. 建立（或選擇）一個 project，設定 **APIs & Services → OAuth consent screen**：
   - User type 選 **External**（要同組織 Workspace 才能選 Internal），填 app 名稱與支援信箱。
   - Scopes 維持 `openid`、`email`、`profile` 即可。
   - 發布狀態是 **Testing** 時，只有列在 **Test users** 的 Google 帳號可以登入；要給正式管理員用時按 **Publish app**。
2. **APIs & Services → Credentials → Create credentials → OAuth client ID**，Application type 選 **Web application**。
3. **Authorized redirect URIs** 必須包含 Supabase Auth 的 callback（這是 Supabase 的網址，不是本站網址）：
   - 正式站：`https://<project-ref>.supabase.co/auth/v1/callback`
   - 本機 Supabase CLI：`http://127.0.0.1:54321/auth/v1/callback`
4. 複製 **Client ID** 與 **Client secret**，下一步要用。

#### 2. Supabase 專案（正式站）

- **Authentication → Providers → Google**：Enable，貼上 Client ID／Client secret 後 Save。
- **Authentication → URL Configuration**：
  - **Site URL**：正式站網址，例如 `https://<你的網域>`。
  - **Redirect URLs**：加入 `https://<你的網域>/admin` 與 `http://localhost:4321/admin`。未列入時 Supabase 會退回 Site URL，`/admin` 就收不到登入回呼。
- 建議同時停用 **Email** provider，只留 Google。

#### 3. 本機 Supabase CLI

`supabase/config.toml` 的 `site_url` 與 `additional_redirect_urls` 已指向本機 dev server，並保留 `[auth.external.google]` 區塊（預設 `enabled = false`，`skip_nonce_check = true` 是本機 Google 登入必需的設定）：

```bash
brew install supabase/tap/supabase          # 這台機器目前沒有安裝 CLI
export SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<client id>
export SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<client secret>
# 將 supabase/config.toml 的 [auth.external.google] enabled 改成 true
supabase stop && supabase start
```

`.env` 的 `PUBLIC_SUPABASE_URL` 必須與實際使用的 Supabase 相符：本機 stack 是 `http://127.0.0.1:54321`（loopback 允許 http），正式站是 `https://<project-ref>.supabase.co`。

#### 快速確認 provider 是否啟用

GoTrue 的設定端點會列出已啟用的登入方式，用 publishable key 就能查（`google: true` 才代表 provider 已啟用）：

```bash
curl -s "$PUBLIC_SUPABASE_URL/auth/v1/settings" \
  -H "apikey: $PUBLIC_SUPABASE_PUBLISHABLE_KEY" | python3 -m json.tool
```

#### 登入失敗對照

| 看到的訊息                                                                               | 原因                                             | 處理                                                    |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| `provider is not enabled`／`Unsupported provider`                                        | Supabase 沒有啟用 Google provider                | 上面的第 2 或第 3 步                                    |
| Google 頁面 `redirect_uri_mismatch`                                                      | Google 端沒有這個 callback 網址                  | 第 1 步第 3 點，字串需完全相同                          |
| `Access blocked: … has not completed the Google verification process`                    | consent screen 還在 Testing                      | 把帳號加進 Test users 或 Publish app                    |
| 登入後回到首頁、`/admin` 沒有登入                                                        | `/admin` 不在 Supabase Redirect URLs             | 第 2 步的 URL Configuration                             |
| 前端顯示「Google 登入失敗，請稍後再試。」且 console 有 `Failed to fetch`／`ECONNREFUSED` | 連不到 Supabase（`.env` 指到沒在跑的本機 stack） | `supabase start`，或把 `PUBLIC_SUPABASE_URL` 改成正式站 |
| 登入成功但顯示「這個帳號沒有管理權限」                                                   | `admin_users` 沒有這個 Google email 的列         | 下一節的 SQL                                            |

6. 如需匯入目前的示範文章，執行 `npm run content:import`。

### 管理者安全佈署與增刪

管理員一律以 Google 登入，`public.admin_users.email` 必須對應 Google 帳號的 email（比對時會正規化為小寫）。新增成員的順序：

1. 請對方先到 `/admin` 用 Google 登入一次；此時 Supabase 會建立 `auth.users` 帳號，但因為還沒有管理列，後台會回應沒有管理權限。
2. 再以 SQL Editor 使用該帳號 UUID 建立管理成員：

```sql
insert into public.admin_users (user_id, email)
select id, lower(email)
from auth.users
where email = 'admin@example.com'
on conflict (user_id) do update set email = excluded.email, updated_at = now();
```

移除管理權限時刪除 `public.admin_users` 對應列；不要把 `SUPABASE_SECRET_KEY` 或管理成員查詢放進瀏覽器。migration 應先套用、再建立管理列，回滾時保留資料表並先移除成員列。

`SUPABASE_SECRET_KEY` 只能放在本機或 Vercel server environment，不可加上 `PUBLIC_`，也不可放進瀏覽器程式。

### 登入方式與傳輸限制

後台只提供 Google 登入，程式碼內沒有密碼欄位與 password grant，`requireAdmin` 也會拒絕以 Supabase `email` provider 取得的 session；請在 Supabase **Authentication → Providers → Email** 一起停用 Email／密碼登入，讓密碼登入在來源就不可能成立。

- 正式站的 `/admin` 與 `/api/admin/*` 一律需透過 HTTPS；部署環境收到純 HTTP 請求時會以 `308` 導向對應的 https 網址，並回傳 HSTS，避免 session token 走明文。本機 loopback（`localhost`、`127.0.0.1`、`::1`）維持可用，方便開發。

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
