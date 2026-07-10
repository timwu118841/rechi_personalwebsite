## 1. 資料平台與相容層

- [x] 1.1 加入 Supabase、Markdown render／sanitize 依賴並將 Astro 切換為 Vercel server output 與原生 CDN cache provider
- [x] 1.2 建立 Supabase SQL migration，涵蓋 articles、site settings、taxonomies、indexes、RLS 與 public media bucket
- [x] 1.3 建立正規化 content repository、Supabase 實作與本機 fixture fallback，包含發布資格、分頁、搜尋與網站設定查詢
- [x] 1.4 建立既有 Git 文章的匯入工具與 production 環境設定驗證

## 2. 驗證與管理 API

- [x] 2.1 實作 Supabase 瀏覽器登入、server token 驗證、管理者 allowlist 與 admin no-store 邊界
- [x] 2.2 實作文章列表／建立／更新管理 API，包含欄位驗證、唯一 slug、草稿／發布／排程／下架
- [x] 2.3 實作網站設定、分類與內容類型管理 API
- [x] 2.4 實作受限圖片上傳 API與 Supabase Storage metadata
- [x] 2.5 在所有成功 mutation 後執行 Astro content／site cache tag 失效

## 3. 管理後台體驗

- [x] 3.1 以自訂 `/admin` 登入頁取代 Keystatic 公開入口，拒絕未登入使用者存取資料
- [x] 3.2 實作文章管理清單與 Markdown 文章編輯器，涵蓋封面、SEO、taxonomy、日期與狀態
- [x] 3.3 實作網站標題、描述、作者姓名／簡介／圖片與預設社群圖設定表單
- [x] 3.4 實作分類與內容類型設定頁，並提供清楚的內容／網站設定導覽

## 4. 即時前台與設計

- [x] 4.1 將首頁、文章、分類、標籤、關於頁改用動態 repository 並設定內容感知 CDN cache tags
- [x] 4.2 實作每頁九篇的文章／taxonomy server pagination 與 canonical、prev／next 合約
- [x] 4.3 將 Pagefind 搜尋替換為即時資料庫搜尋，維持鍵盤與無 JavaScript 可用性
- [x] 4.4 將 RSS、sitemap、robots 與文章 JSON-LD 改為即時內容來源並排除私密內容
- [x] 4.5 實作文章卡片與詳情封面、預設圖片 fallback、intrinsic dimensions 與載入優先級
- [x] 4.6 實作無閃爍、可持久化、可存取的 Dark Mode 與完整色彩 token

## 5. 測試、文件與交付

- [x] 5.1 補齊 repository、發布資格、驗證、Markdown sanitization、搜尋與分頁單元測試
- [x] 5.2 更新 Playwright E2E，驗證公開閱讀、分頁、主題、搜尋、admin 登入邊界與 fixture 即時內容
- [x] 5.3 更新 README、環境變數範例與 Supabase／Vercel 設定及回滾說明
- [x] 5.4 執行 format、lint、typecheck、unit、production build、E2E、SEO／bundle 驗證並修正所有回歸
- [x] 5.5 執行 OpenSpec strict validation、完成 Lore commit 並推送功能分支
