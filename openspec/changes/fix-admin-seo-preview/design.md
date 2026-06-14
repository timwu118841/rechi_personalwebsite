## Context

目前 `generateTitle` 寫死 `Payload Website Template`，`generateURL` 只產生 `/{slug}`。實際前台文章路徑包含語系與 `/posts/`。

## Goals / Non-Goals

**Goals:**

- 後台產生標題使用當前語系網站名稱。
- 後台產生網址符合文章、固定頁面與首頁路由。
- 無法取得網站設定時使用既有語系預設名稱。

**Non-Goals:**

- 不更動實際前台 metadata 規則。
- 不加入分析或流量追蹤。

## Decisions

- 將可測試的 title 與 URL 規則抽至 `src/lib/admin-seo.ts`。
- plugin callback 使用 `req.payload.findGlobal` 取得本地化 Site Settings。
- locale 僅接受 `en`，其他值回退為 `zh-Hant`。

## Risks / Trade-offs

- SEO 自動標題需要一次 global 查詢；只在後台編輯操作觸發，成本有限。
- 查詢失敗時回退固定名稱，避免阻止編輯。

## Migration Plan

無 migration。部署後重新載入管理後台即可使用新預覽。
