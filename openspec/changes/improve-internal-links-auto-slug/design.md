## Context

共用 Lexical 設定目前移除 Payload 原生 `url` 欄位再自行建立，遺失套件內建的連結條件、驗證與編輯行為。公開 RichText converter 則直接輸出 `/posts/{slug}`，沒有使用文章頁面的 locale。Posts 的 slug 是必填文字欄位，尚未使用 Payload 3.85.1 內建的 `slugField` 草稿／發布穩定機制。

## Goals / Non-Goals

**Goals:**

- 讓管理員可新增、重新開啟及修改站內文章與固定頁面連結。
- 讓文章內容中的站內連結使用目前公開頁面語系。
- 草稿期間依本語系標題自動產生 slug。
- 發布後不因標題修改而更動既有 slug。
- 保留手動設定 slug 的選項與既有文章 slug。

**Non-Goals:**

- 不自製 Lexical 連結視窗。
- 不自動翻譯 slug。
- 不批次改寫既有文章內容或既有 slug。
- 不處理跨語系文章自動配對或語系 fallback。

## Decisions

### 1. 使用 Payload 內建 LinkFeature 欄位

保留 `enabledCollections: ['pages', 'posts']`，移除自訂 `fields` 覆寫。這可重新取得 Payload 對 custom／internal link 的內建條件、驗證及編輯支援，並降低升級維護成本。

### 2. RichText 明確接收 locale

文章頁面將已驗證的 locale 傳入 RichText。converter 以純函式依 `relationTo`、slug 與 locale 產生網址：文章為 `/{locale}/posts/{slug}`，固定頁面為 `/{locale}/{slug}`；首頁 slug 則回到 `/{locale}`。未傳入 locale 的既有使用處沿用預設語系，避免擴大本次改動。

### 3. Posts 採用 Payload slugField

以 `slugField({ localized: true })` 取代手動文字欄位。Payload 內建 `generateSlug` 控制會在建立及未發布草稿時依標題更新 slug；管理員手動覆寫或文章發布後會停止自動更新，符合固定公開網址需求。欄位補上中英文標籤與說明。

### 4. Schema 以 migration 發布

`slugField` 會新增 `generateSlug` 儲存欄位，因此產生 PostgreSQL migration 並納入現有 Vercel `payload migrate` 部署流程。既有 slug 欄位與資料不刪除。

## Risks / Trade-offs

- [未傳 locale 的非文章 RichText 仍使用預設語系] → 本次先鎖定文章內容；介面保留 locale 參數，後續可逐層傳入固定頁面 blocks。
- [中文標題產生中文 slug] → Next.js 路由可支援並會安全編碼；管理員仍可改成英文 slug。
- [發布後變更 slug 仍可能造成舊網址失效] → 僅允許明確手動覆寫，不因標題修改而自動發生。

## Migration Plan

1. 產生並提交 Payload migration。
2. Vercel 建置執行 `npm run payload migrate` 後再 build。
3. migration 只新增自動 slug 控制資料，不改寫既有 slug。

## Open Questions

無。
