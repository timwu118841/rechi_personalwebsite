## Context

`Posts.heroImage` 已由 Payload 查詢以 `depth: 2` 回傳完整媒體資料，但目前只有 SEO 工具讀取，前台元件未使用。

## Goals / Non-Goals

**Goals:**

- 封面圖片在文章頁可見。
- 保留媒體替代文字並響應式呈現。
- 沒有封面圖時不產生空白容器。
- 文章封面不自動改變首頁或列表版面。

**Non-Goals:**

- 不調整上傳儲存方式。
- 不新增圖片裁切欄位或第三方圖片服務。

## Decisions

- 重用既有 `Media` 元件，維持 Payload URL 與 Next Image 最佳化流程。
- 文章頁主圖放在文章標頭後、正文前。
- `PostCard` 維持純文字版面；首頁圖片應由未來獨立欄位或全站設定控制。

## Risks / Trade-offs

- 若媒體關聯僅是 ID，元件不渲染；目前公開查詢 `depth: 2` 已滿足完整資料需求。

## Migration Plan

無資料 migration，部署後既有文章只要已設定封面圖即會顯示。
