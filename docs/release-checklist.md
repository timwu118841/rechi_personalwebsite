# 上線與回歸檢查表

本檢查表必須在目標環境逐項執行。`npm run deploy:validate` 只驗證本機程序收到的環境變數，不代表遠端 Supabase、Storage、Notion 或 Vercel 已通過驗證。

## Supabase 與 Vercel

- [ ] 新 Supabase project 已在 SQL Editor 執行 `supabase/all-migrations.sql`，或依序執行下列 migration；兩種方式不可在同一個 project 重複執行
- [ ] 已套用 `supabase/migrations/202607100001_realtime_content.sql`
- [ ] 已依序套用 `supabase/migrations/202607110001_rich_article_body.sql`
- [ ] 已依序套用 `supabase/migrations/202607110002_unicode_article_slugs.sql`
- [ ] 已依序套用 `supabase/migrations/202607110003_atomic_article_save.sql`
- [ ] 已套用 `supabase/migrations/202607110004_admin_users.sql`，且 `public.admin_users` 只有核准、已驗證的 Auth 使用者
- [ ] 已依序套用 `supabase/migrations/202607110005_admin_users_status.sql`，並確認管理員狀態欄位與索引已建立
- [ ] 已依序套用 `supabase/migrations/202607150001_notion_content_pipeline.sql`，並確認內容工作、來源 revision、候選、審查與媒體資料表已建立
- [ ] 已依序套用 `supabase/migrations/202607150002_enqueue_content_job_rpc.sql`，並確認 `enqueue_content_job` RPC 可對 active job 去重、對已完成 dedupe key 重新排程
- [ ] Supabase 已啟用 Google provider、callback URI 與 `/admin` Redirect URL；`PUBLIC_ADMIN_PASSWORD_LOGIN` 已依相容期策略設定
- [ ] Vercel 已設定 `SITE_URL`、`PUBLIC_SUPABASE_URL`、`PUBLIC_SUPABASE_PUBLISHABLE_KEY`、`SUPABASE_SECRET_KEY`、`CRON_SECRET` 與 `NOTION_EDITORIAL_ENABLED`；未設定 `ALLOW_FIXTURE_CONTENT=true`
- [ ] `SUPABASE_SECRET_KEY`、`CRON_SECRET` 與 `NOTION_TOKEN` 只存在 server environment，未加上 `PUBLIC_`、未提交到 Git、未出現在瀏覽器 bundle
- [ ] 若啟用 Notion：使用者已提供 internal integration secret／API key 作為 `NOTION_TOKEN`、root UUID 作為 `NOTION_ROOT_PAGE_ID`，並設定 `NOTION_EDITORIAL_ENABLED=true`、`NOTION_VERSION=2026-03-11`
- [ ] rollout 設定維持 `CONTENT_PUBLIC_READ_MODE=service`、`NOTION_PUBLICATION_MODE=legacy`；若要改值，先確認部署版本已有作用中的切換 call site
- [ ] `npm run deploy:validate`、`npm run quality`、`npm run test:e2e:ci` 全部成功
- [ ] preview 回應含 `X-Robots-Tag: noindex, nofollow`

## Notion、Cron 與 Storage

- [ ] 已由 Workspace Owner 建立具讀取內容能力的 Notion internal integration，並將 Installation access token（internal integration secret／API key）設為 server-only `NOTION_TOKEN`
- [ ] 已開啟 root page，從右上角 **••• → Connections → Add connection** 分享給 integration，並確認直屬文章頁繼承存取權
- [ ] `NOTION_ROOT_PAGE_ID` 是 root page URL 末端的 32 個十六進位字元（可含 UUID 連字號），不是完整網址
- [ ] `/admin` 的 root sync 只列舉 root 的直屬 `child_page`；孫頁與更深層頁面不會自動同步，所有文章頁都直接位於 root 下
- [ ] Vercel Production 已建立每日執行的 `/api/internal/content-worker` Cron（`0 0 * * *`，UTC 00:00／台灣時間 08:00），且請求帶有 `Authorization: Bearer <CRON_SECRET>`
- [ ] 已確認每輪 worker 最多處理 5 個 jobs；大量直屬頁面會由後續 Cron 輪次繼續處理
- [ ] 未授權的 worker 請求回應 `401`；缺少 `CRON_SECRET` 時回應 `503`；回應不可快取且不可索引
- [ ] Supabase Storage 全域檔案上限至少 25 MB
- [ ] `notion-staging` 為 private、單檔 25 MB；`site-media` 為 public、單檔 5 MB；兩者未存放敏感案件資料
- [ ] 已確認 migration 建立的 bucket、RLS 與 service key 存取符合目標 Supabase project；未將本機 migration 成功當成遠端驗證

## 功能驗收

- [ ] `/admin` 可登入、建立草稿、發布、下架與重新編輯，不產生 Git commit 或 deployment
- [ ] Root sync 能為每個直屬 `child_page` 排入 source job，且每頁都能建立或更新 source、不可變 revision 與 working copy；同步不會改變目前公開文章
- [ ] 單頁 page ID 同步仍可獨立排入；候選需完成隱私與法律審查才可發布
- [ ] Notion 內容在候選建立後變更或移到垃圾桶時，freshness gate 會取消舊候選
- [ ] 新文章立即出現在文章頁、列表、搜尋、RSS 與 sitemap
- [ ] 封面、作者圖片、網站標題與作者簡介更新後能出現在前台
- [ ] 未登入／不在 `public.admin_users` 的帳號無法讀取草稿或呼叫管理 API
- [ ] 後台 `site-media` 上傳只接受 JPEG、PNG、WebP、AVIF，5 MB 上限正常
- [ ] Notion converter 的 allowlist 與 fail-closed 行為正常；不支援的 block 或 rich text 不會部分發布
- [ ] Notion 圖片只接受官方 `s3.us-west-2.amazonaws.com/secure.notion-static.com/` URL、JPEG／PNG／WebP／AVIF 與 5 MB 上限；外部圖片網域、redirect、MIME／檔案 signature 不符及超限內容都會拒絕
- [ ] 含圖片頁面可在下載驗證後 promotion 到公開 `site-media`，working copy 使用 promotion 後 URL；圖片失敗時 source job 不會留下部分完成內容
- [ ] Dark Mode、文章分頁、分類、標籤、404 與無 JavaScript 閱讀正常
- [ ] Umami 未設定／被阻擋時網站無錯；設定後不傳送搜尋字詞或敏感資料

## 效能與 SEO

- [ ] 公開回應含 `Vercel-CDN-Cache-Control` 與 `Vercel-Cache-Tag`
- [ ] 發布或網站設定更新後，相關 cache tag 會失效且不需重新部署
- [ ] Lighthouse Performance、Accessibility、Best Practices 至少 95，SEO 100
- [ ] 文章頁初始 JavaScript gzip 不超過 75 KB，正文沒有 React hydration
- [ ] Search Console 已提交 `/sitemap.xml`

正式流量每週依頁型檢視第 75 百分位：LCP ≤ 2.5 秒、INP ≤ 200 毫秒、CLS ≤ 0.1。

## 回滾

1. 將 Vercel production alias 指回上一個通過驗證的 deployment。
2. 資料問題先在後台將文章下架；不要刪除資料表或 Storage object。
3. 若需回復舊架構，原始 `src/content` 文章仍可作為唯讀來源。
4. 驗證公開 URL、搜尋、RSS、sitemap、管理登入與安全標頭。
