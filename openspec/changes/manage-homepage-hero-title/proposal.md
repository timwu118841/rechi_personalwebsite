## Why

首頁主標題目前寫死在翻譯檔，管理員無法從 Payload 後台修改。

## What Changes

- 在「網站設定」新增本地化的首頁主標題欄位。
- 首頁優先使用後台設定值。
- 未設定時回退至現有中英文預設文案。

## Capabilities

### New Capabilities

- `homepage-hero-management`: 管理員可依語系維護首頁主標題。

## Impact

- 修改 SiteSettings global、首頁渲染與 Payload 產生型別。
- 不需要手動 migration。
