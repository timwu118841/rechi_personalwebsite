## Why

Payload 預設 slugify 只保留 ASCII 字元，中文標題自動產生 slug 時會被清空，管理員仍必須手動填寫網址。

## What Changes

- 新增共用 Unicode slugify，保留中文、英文字母與數字。
- 空白與標點轉為單一連字號，移除頭尾連字號並將英文轉小寫。
- 文章與固定頁面的自動 slug 都使用相同規則。

## Capabilities

### New Capabilities

- `unicode-auto-slugs`: 中文及混合語言標題可自動產生安全、穩定的 slug。

### Modified Capabilities

無。

## Impact

- 影響共用 slug 工具、Posts 與 Pages collection 設定及測試。
- 不變更資料庫 schema，也不改寫既有 slug。
