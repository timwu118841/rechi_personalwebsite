## 1. 專案基礎與品質工具

- [x] 1.1 初始化 TypeScript Astro 專案與部署 adapter，預設預先產生所有公開頁，只讓 Keystatic 管理／驗證路由採 on-demand rendering
- [x] 1.2 加入格式化、lint、型別檢查與測試基礎，讓 CI 能以單一品質指令執行
- [x] 1.3 建立集中式站台設定，容納站名、網域、作者、社群連結、品牌資產、免責聲明與站長驗證值

## 2. CMS、內容模型與發布流程

- [ ] 2.1 整合 Keystatic Astro 管理介面與 Keystatic Cloud／GitHub storage，設定受邀使用者驗證、秘密環境變數、admin noindex 與拒絕未授權寫入
- [x] 2.2 建立 CMS 文章 collection 與型別安全內容 schema，涵蓋唯一穩定 slug、封面／內文媒體、發布狀態、日期、分類、標籤、SEO 覆寫與正文編輯器
- [x] 2.3 實作草稿、格式化預覽、發布、下架與未來日期過濾，讓 CMS 自動版本化內容並觸發 preview／production 建置
- [x] 2.4 實作媒體上傳格式／大小限制、替代文字驗證與 Astro 圖片 pipeline 相容的儲存設定
- [x] 2.5 建立 CMS 內的文章範本、欄位說明與發布前匿名化／法律內容檢查清單
- [ ] 2.6 為授權、有效內容、缺欄位、錯誤日期、重複 slug、草稿、下架與未來文章補齊自動化測試
- [x] 2.7 建立可由後台新增、改名、排序與停用的文章分類 collection，讓文章以關聯欄位選取分類，並讓公開分類頁與文章中繼資料同步使用分類設定
- [x] 2.8 建立可由後台新增與改名的內容類型 collection，將文章內容類型與主題分類拆成獨立關聯，並把後台導覽分為內容編輯與內容設定

## 3. 設計系統與共用版型

- [x] 3.1 建立色彩、字體、間距、欄寬、圓角、陰影與動態效果 design tokens，支援行動裝置、桌面、鍵盤焦點與 reduced motion
- [x] 3.2 實作全站 layout、語意化 header／main／footer、響應式導覽、skip link 與可存取的搜尋入口
- [x] 3.3 實作文章卡片、分類／標籤、日期、閱讀時間、作者資訊、分享連結、空狀態與法律免責聲明共用元件

## 4. 閱讀與內容探索頁面

- [x] 4.1 實作首頁精選／最新文章區塊與文章總覽，確認只顯示符合發布條件的內容並依日期排序
- [x] 4.2 實作文章詳情頁與長文排版，涵蓋封面、標題階層、程式碼／引用／清單／圖片、更新日期、分類、標籤與免責聲明
- [x] 4.3 實作分類與標籤索引及詳情頁，包含可讀 URL、筆數、空狀態與返回探索路徑
- [x] 4.4 實作關於頁與 404 頁，並確認不依賴 client-side JavaScript 仍可使用核心導覽與閱讀功能
- [x] 4.5 加入 Pagefind 類型的建置後全文索引與可鍵盤操作的搜尋 UI，驗證草稿／未來文章不進入索引且無結果時有替代探索連結

## 5. SEO 與內容發現產物

- [x] 5.1 建立共用 SEO 元件，輸出唯一 title、description、absolute canonical、語系、Open Graph 與社群圖片資料
- [x] 5.2 為文章、網站與麵包屑產生符合可見內容的 JSON-LD，並加入結構與語法測試
- [x] 5.3 產生 sitemap、robots 與 RSS，驗證正式網域、絕對 URL、發布資格與草稿排除規則
- [x] 5.4 對 preview、404、內部搜尋與其他非索引頁加入 noindex，並加入 metadata、canonical、內部連結與私密內容洩漏檢查

## 6. 分析、隱私與站長工具

- [x] 6.1 建立可關閉的 analytics adapter，確保只有 production 且設定有效時才延後載入供應商程式
- [x] 6.2 實作頁面瀏覽、閱讀進度、外部連結與站內搜尋結果數事件，加入 payload allowlist 並測試不傳送搜尋原文或法律個案個資
- [x] 6.3 為需要 cookie／跨站識別的供應商實作同意門檻與撤回機制，或記錄所選免 cookie 供應商不需要該流程的驗證依據
- [x] 6.4 以環境設定支援 Google Search Console 等站長工具驗證，並文件化正式站 sitemap 提交流程

## 7. 效能、無障礙與韌性

- [x] 7.1 建立響應式圖片 pipeline、固定圖片尺寸、首屏載入優先級、其餘 lazy-load 與自託管／系統字型策略
- [x] 7.2 建立 production bundle 檢查，保證代表文章頁初始 JavaScript 不超過 75 KB gzip 且正文不 hydration
- [x] 7.3 加入代表路由的自動化無障礙、鍵盤操作、色彩對比、縮放、失效 analytics 與無 JavaScript 測試
- [x] 7.4 設定 Lighthouse CI 門檻：Performance、Accessibility、Best Practices 至少 95，SEO 100，並在回歸時阻擋發布
- [x] 7.5 文件化隱私相容的 Web Vitals 監控方式與 LCP、INP、CLS 第 75 百分位告警／檢視流程

## 8. 部署與上線驗證

- [x] 8.1 建立 CI pipeline，依序執行內容驗證、format、lint、typecheck、測試、production build、Pagefind 索引、連結／SEO 與 Lighthouse 檢查
- [ ] 8.2 設定具 CDN 與 server function 的託管平台，讓公開頁使用靜態快取、Keystatic 路由使用受保護 on-demand runtime，並完成 preview noindex、安全標頭與回滾流程
- [ ] 8.3 以正式候選部署執行桌機／行動裝置煙霧測試，驗證登入、建立草稿、預覽、發布、下架、媒體上傳、主要公開路由、搜尋、RSS、sitemap、robots、分析與錯誤頁
- [ ] 8.4 綁定正式網域後提交 sitemap、確認搜尋引擎可抓取、建立流量與 Core Web Vitals 基準，並記錄上線驗收結果
