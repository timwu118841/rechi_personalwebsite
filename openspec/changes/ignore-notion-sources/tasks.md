## 1. 資料庫

- [ ] 1.1 新增 `202609130001_ignore_article_sources.sql`：`article_sources.ignored_at`、部分索引
- [ ] 1.2 新增 `set_article_sources_ignored(uuid[], boolean, uuid)` RPC：批次驗證、取消排隊工作與未上線候選、寫入審計
- [ ] 1.3 以 `create or replace` 讓 `prepare_publication_candidate` 拒絕已忽略來源，並維持 service_role grant
- [ ] 1.4 將 migration 內容同步進 `supabase/all-migrations.sql` bundle

## 2. 服務層與 API

- [x] 2.1 `ContentJobService.setSourcesIgnored()` 呼叫 RPC 並回傳更新後來源
- [x] 2.2 `selectDataSourceSyncTargets` 排除已忽略來源；`syncSource` 對已忽略來源直接中止
- [x] 2.3 `listSourceStatus` 回傳 `ignored_at`，後台據此分組與切換顯示
- [x] 2.4 `parseIgnoredFlag`／`parseSourceRetirementRequest` 驗證請求（1–200 個 id、boolean 旗標）
- [x] 2.5 `PATCH /api/admin/notion/sources/[id]/retirement` 單筆忽略／復原
- [x] 2.6 `POST /api/admin/notion/sources` 批次端點

## 3. 管理後台

- [x] 3.1 來源列顯示忽略狀態與時間，並提供忽略／復原操作
- [x] 3.2 批次勾選與批次忽略／復原工具列
- [x] 3.3 已忽略來源預設隱藏並可切換顯示

## 4. 文件與驗證

- [x] 4.1 README 補充來源忽略行為與還原方式
- [x] 4.2 單元測試：批次驗證、計畫排除、同步守門、RPC 參數與錯誤對應
- [x] 4.3 Playwright 覆蓋單筆與批次忽略／復原（桌面與行動版）
- [x] 4.4 `npm run db:verify-migrations`、format、lint、typecheck、unit、production build 全數通過
