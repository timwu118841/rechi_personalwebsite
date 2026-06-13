## Why

目前文章編輯器缺少細分字級與固定字色，管理員難以在長篇法律文章中建立清楚的內容層次。需要在維持專業一致性與前台安全的前提下，補足常用排版能力。

## What Changes

- 為文章內容編輯器加入 16 種固定字體顏色。
- 加入 12、14、16、18、20、24、28、32、36、40px 字級。
- 加入底線、刪除線、對齊、清單、引用、縮排、上標與下標等排版工具。
- 保留現有標題、連結、圖片、提示框、程式碼與分隔線。
- 前台以白名單安全渲染字色與字級，並限制手機上的超大文字。
- 既有文章維持相容，不需要資料 migration。

## Capabilities

### New Capabilities

- `rich-text-authoring`: 管理員可使用受控的進階文字格式撰寫文章，且公開頁面正確、安全地呈現格式。

### Modified Capabilities

無。

## Impact

- 影響 Posts rich text editor 設定、前台 RichText converter、文章 CSS、Payload generated types 與相關測試。
- 不新增第三方依賴，也不改變 PostgreSQL schema。
