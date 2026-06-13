## Why

網站定位為純內容型法律部落格，第一階段明確不提供聯絡、預約或資料蒐集表單。Payload 範本殘留的表單功能增加後台項目、前端程式與依賴，容易讓管理員誤以為網站需要處理訪客回覆。

## What Changes

- 移除 Payload Form Builder 外掛及其「表單」「表單回覆」後台 collections。
- 移除固定頁面可加入的表單區塊及前端表單送出程式。
- 移除範例聯絡表單 seed 程式。
- 移除僅供表單功能使用的套件依賴。
- 保留 PostgreSQL 既有資料表，不在本次清理中執行破壞性 schema migration。

## Capabilities

### New Capabilities

- `focused-content-management`: 後台只提供法律部落格目前需要的內容管理功能，不暴露未採用的訪客表單與回覆管理。

### Modified Capabilities

無。

## Impact

- 影響 Payload plugin 設定、Pages layout blocks、前端 block renderer、seed 程式、產生型別與套件依賴。
- `/api/form-submissions` 將不再由 Payload 提供。
- 已存在於資料庫的表單相關資料不會在本次變更中刪除。
