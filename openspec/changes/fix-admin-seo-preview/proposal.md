## Why

Payload 後台 SEO 自動產生器仍顯示範本名稱，且預覽網址沒有語系與文章路徑，與實際前台網址不一致。

## What Changes

- SEO 自動標題改用網站名稱，不再顯示 Payload 範本名稱。
- 文章網址產生為 `/{locale}/posts/{slug}`。
- 固定頁面網址產生為 `/{locale}/{slug}`，首頁頁面使用 `/{locale}`。
- 保留 production 網域設定。

## Capabilities

### New Capabilities

- `accurate-admin-seo-preview`: 後台 SEO 預覽與公開網站 metadata、路由一致。

## Impact

- 修改 SEO plugin 產生器與測試。
- 不變更資料庫 schema。
