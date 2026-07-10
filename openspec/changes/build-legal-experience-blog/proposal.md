## Why

需要一個能長期累積法律實務經驗、容易閱讀且可被搜尋引擎發現的個人部落格。網站必須避免過去 Payload CMS 帶來的高延遲與維運負擔，同時提供可量測的內容成效，讓文章發布不犧牲效能、SEO 或讀者隱私。

## What Changes

- 建立類似 Medium 閱讀體驗的繁體中文個人法律部落格，包含首頁、文章列表、文章頁、分類／標籤頁、作者資訊與搜尋入口。
- 建立僅限受邀作者登入的 CMS 管理後台，提供類似傳統部落格的表單／所見即所得編輯、圖片上傳、草稿、預覽、發布／下架、發布日期、摘要、分類、標籤與 SEO 欄位，不要求作者操作 Git 或 Markdown。
- 採 Keystatic Cloud／GitHub-backed CMS 與靜態優先內容架構：後台自動把內容版本化到 Git，公開頁面在建置時產生，不在每次讀者請求時查詢 CMS 或資料庫。
- 提供完整技術 SEO：語意化 HTML、canonical、Open Graph、結構化資料、sitemap、robots、RSS，以及可索引性檢查。
- 提供可設定、低負擔且尊重隱私的流量分析，追蹤頁面瀏覽、文章閱讀與來源成效，並支援站長工具驗證。
- 設定可驗證的效能與無障礙門檻，避免分析程式、圖片與內容系統拖慢 Core Web Vitals。

## Capabilities

### New Capabilities
- `legal-content-authoring`: 受保護的 CMS 後台、法律文章內容模型、視覺化編輯、媒體管理、草稿／發布流程、分類與標籤。
- `blog-discovery-and-reading`: 現代簡潔的首頁、文章探索、分類／標籤、站內搜尋與專注閱讀體驗。
- `search-engine-visibility`: 搜尋引擎可索引性、頁面中繼資料、結構化資料、sitemap、robots 與 RSS。
- `privacy-aware-traffic-analytics`: 低負擔流量分析、核心閱讀事件、站長工具驗證與隱私控制。
- `web-performance-quality`: 靜態優先交付、圖片與字型最佳化、JavaScript 預算、Core Web Vitals 與無障礙品質門檻。

### Modified Capabilities

無。

## Impact

- 建立新的前端網站、內容目錄／schema、設計系統、SEO 產物、分析整合與自動化驗證。
- 導入 Keystatic 管理介面與受保護的伺服器端管理／驗證路由，但不導入 Payload CMS，也不讓任何公開閱讀路由依賴執行時 CMS／資料庫查詢。
- 需要支援 Astro 靜態頁與 Keystatic 管理路由的部署 adapter、Keystatic Cloud／GitHub 專案、圖片處理方式與分析供應商；所有第三方秘密須由環境設定管理。
- 內容涉及法律經驗，網站需清楚標示一般資訊與個案經驗分享，不構成法律意見，並避免不必要的個資或案件識別資訊。
