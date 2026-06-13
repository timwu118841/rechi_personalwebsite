## Context

專案由 Payload Website Template 起始，因此仍包含 Form Builder plugin、表單區塊、表單送出元件與聯絡表單 seed。網站需求已明確排除預約、聯絡與訪客資料蒐集功能，這些程式沒有產品用途。

## Goals / Non-Goals

**Goals:**

- 讓 Payload 後台不再註冊 `forms` 與 `form-submissions` collections。
- 讓固定頁面只提供實際需要的內容區塊。
- 移除表單專用前端程式、seed 與套件依賴。
- 重新產生 Payload 型別，確保程式不再參照表單型別。

**Non-Goals:**

- 不刪除 PostgreSQL 內既有的表單相關資料表或資料。
- 不建立新的聯絡方式、預約功能或 Email 寄送流程。
- 不調整其他文章、頁面、搜尋或 SEO 功能。

## Decisions

### 1. 完整移除表單功能，而非只從後台隱藏

只隱藏後台選單仍會保留公開 API、套件依賴與前端表單程式，不符合縮小功能與攻擊面的目標。因此從 Payload plugins、Pages blocks、RenderBlocks、seed 與 dependencies 一併移除。

### 2. 保留資料庫舊表格

Payload schema 同步或 migration 涉及資料刪除風險。本次只停止應用程式註冊與使用表單 collections，不執行 DROP TABLE。若未來需要清除資料庫，另建可備份、可回滾的 migration。

### 3. 以設定回歸測試鎖定後台與頁面模型

測試直接檢查 plugins 不含 Form Builder、Pages layout 不含 `formBlock`，避免範本更新時重新帶回未採用功能。套件與孤立檔案則由型別檢查、搜尋與 build 驗證。

## Risks / Trade-offs

- [既有頁面若已使用表單區塊，重新儲存時該區塊將無法繼續編輯] → 此網站尚未採用表單；舊資料仍保留於 PostgreSQL，未被破壞。
- [移除外掛後 `/api/form-submissions` 不再存在] → 這符合網站不接受訪客表單的產品需求。
- [套件移除可能影響 lockfile] → 使用 npm uninstall 更新 `package.json` 與 `package-lock.json`，並以完整 build 驗證。

## Migration Plan

1. 加入設定回歸測試。
2. 移除外掛、頁面區塊、renderer 與 seed 參照。
3. 刪除表單元件和 seed 檔案。
4. 移除套件並重新產生 Payload 型別與 import map。
5. 執行測試、typecheck、lint、build 與 OpenSpec validation。

回滾時還原程式碼與套件即可；資料庫因未刪表而不需要資料復原。

## Open Questions

無。
