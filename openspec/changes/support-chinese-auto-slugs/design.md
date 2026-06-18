## Context

Payload 3.85.1 預設使用 `/[^\w-]+/g` 過濾 slug，因此所有中文字元都會被移除。`slugField` 支援傳入自訂 `slugify`，可在不改變草稿自動產生與發布後固定機制的情況下替換字元規則。

## Goals / Non-Goals

**Goals:**

- 支援中文、英文、數字與混合語言標題。
- 將空白及標點統一轉為連字號。
- Posts 與 Pages 共用同一規則。
- 保留既有 slug 與發布後固定行為。

**Non-Goals:**

- 不將中文自動翻譯或轉成拼音。
- 不批次修改既有資料。

## Decisions

建立純函式 `slugifyUnicode`：先做 NFKC 正規化與小寫轉換，再將所有非 Unicode 字母、數字的區段轉為 `-`，最後合併及移除頭尾連字號。Posts 與 Pages 的 `slugField` 皆注入此函式。

## Risks / Trade-offs

- 中文網址在瀏覽器或分享工具中可能顯示百分比編碼，但實際網址與 SEO 均可正常運作。
- 不同語系若標題相同仍受現有 unique constraint 限制。

## Migration Plan

不需要 migration；部署後只影響新產生或仍開啟自動產生的草稿 slug。

## Open Questions

無。
