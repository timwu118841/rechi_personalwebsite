## Why

目前文章編輯器的連結欄位覆寫了 Payload 內建設定，造成既有連結難以編輯；前台站內連結也未包含目前語系，會導向不存在或錯誤語系的頁面。文章 slug 又必須手動維護，增加發布負擔與網址誤改風險。

## What Changes

- 恢復 Payload 內建連結欄位，讓管理員可正常新增及編輯站內文章／固定頁面連結。
- 前台依目前文章語系產生站內網址，例如 `/zh-Hant/posts/example` 與 `/en/posts/example`。
- 文章 slug 在草稿階段依各語系標題自動產生。
- 文章發布後停止因標題變更而自動修改 slug，保護既有網址與 SEO。
- 保留管理員手動覆寫 slug 的能力。
- 產生 Payload PostgreSQL migration，加入自動 slug 控制欄位。

## Capabilities

### New Capabilities

- `localized-internal-links`: 文章內容的站內連結可正常編輯，且公開網址會保留目前語系。
- `stable-post-slugs`: 文章 slug 可由標題自動產生，發布後維持穩定並允許手動覆寫。

### Modified Capabilities

無。

## Impact

- 影響共用 Lexical 連結設定、文章 RichText 前台 converter、Posts collection、文章頁面、Payload generated types、資料庫 migration 與相關測試。
- 不新增第三方依賴。
