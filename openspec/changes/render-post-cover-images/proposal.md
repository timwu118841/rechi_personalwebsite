## Why

文章的封面圖片目前只提供 SEO 與社群分享 metadata 使用，前台頁面沒有實際渲染，造成管理員設定後看不到效果。

## What Changes

- 在文章內頁標題資訊下方顯示封面主圖。
- 未設定封面圖片時維持現有純文字版面。
- 首頁與列表不自動使用文章封面，首頁圖片日後由獨立設定控制。

## Capabilities

### New Capabilities

- `post-cover-rendering`: 在公開文章內頁呈現 Payload 的文章封面圖片，並與首頁展示設定分離。

## Impact

- 修改文章卡片、文章內頁與公開網站樣式。
- 不變更資料庫 schema，也不需要資料 migration。
