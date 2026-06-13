## Context

Payload 3.85.1 的文章 editor 已具備標題、blocks、工具列與水平分隔線，但未設定 `TextStateFeature`。前台使用 Payload 預設 JSX converter，該 converter 不會自動套用 TextState 的字色與字級。

## Goals / Non-Goals

**Goals:**

- 提供固定 16 色與 10 種字級。
- 啟用常用文字格式、對齊、清單、引用與縮排。
- 讓前台僅渲染白名單文字樣式。
- 不影響既有文章。

**Non-Goals:**

- 不提供任意色碼、背景色或字體家族。
- 不自製完整 Lexical 工具列框架。
- 不新增表格、影片嵌入或第三方套件。

## Decisions

### 1. 集中文章 editor 設定

建立 `src/fields/postEditor.ts`，統一保存色盤、字級、Payload features 與 editor instance，避免 Posts collection 承擔過多設定。

### 2. 使用 TextStateFeature

文字節點只保存顏色與字級的狀態鍵，實際 CSS 留在程式白名單。相比保存任意 inline CSS，這較容易維護並可阻止不受控樣式。

### 3. 自訂前台文字 converter

建立 `src/lib/rich-text-style.tsx`，讀取 Lexical node 的 `$` state，將合法鍵映射成 React style，未知值一律忽略。其他對齊與縮排沿用 Payload converter。

### 4. 響應式限制大字級

前台為合法字級輸出 `data-font-size`，CSS 在 640px 以下將 28–40px 限制於可閱讀範圍；資料本身不被修改。

## Risks / Trade-offs

- [`TextStateFeature` 為 experimental] → 集中於單一模組並以測試鎖定資料契約。
- [Payload 內建工具列無法完全複製自製 B 版面] → 優先使用下拉群組與內建排列，避免高維護成本。
- [前台 converter 與 Payload format bitmask 需保持一致] → 以整合測試覆蓋粗體、底線、字色與字級組合。

## Migration Plan

不需要資料 migration。部署前重新產生 Payload types，既有無 `$` state 的文字節點維持原樣。

## Open Questions

無。
