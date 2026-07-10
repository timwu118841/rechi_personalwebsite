# 上線與回歸檢查表

## Supabase 與 Vercel

- [ ] 已套用 `supabase/migrations/202607100001_realtime_content.sql`
- [ ] Auth 只有核准管理者帳號，`ADMIN_EMAILS` 與實際 email 相符
- [ ] Vercel 已設定 `SITE_URL`、Supabase 三個 key、`ADMIN_EMAILS`；未設定 `ALLOW_FIXTURE_CONTENT=true`
- [ ] `npm run deploy:validate`、`npm run quality`、`npm run test:e2e:ci` 全部成功
- [ ] preview 回應含 `X-Robots-Tag: noindex, nofollow`

## 功能驗收

- [ ] `/admin` 可登入、建立草稿、發布、下架與重新編輯，不產生 Git commit 或 deployment
- [ ] 新文章立即出現在文章頁、列表、搜尋、RSS 與 sitemap
- [ ] 封面、作者圖片、網站標題與作者簡介更新後能出現在前台
- [ ] 未登入／非 allowlist 帳號無法讀取草稿或呼叫管理 API
- [ ] 圖片格式與 5 MB 上限正常，Storage bucket 不含敏感案件資料
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
