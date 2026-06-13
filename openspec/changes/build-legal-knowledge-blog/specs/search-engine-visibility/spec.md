## ADDED Requirements

### Requirement: Page metadata
系統 SHALL 為每個可索引頁面輸出唯一標題、描述、canonical URL、Open Graph 與適當語言資訊。

#### Scenario: Search engine requests an article
- **WHEN** 搜尋引擎讀取已發布文章頁
- **THEN** 系統輸出文章專屬 metadata，缺少自訂 SEO 欄位時回退使用文章標題、摘要與封面

### Requirement: Language alternates
系統 SHALL 僅為已發布的對應語言頁輸出 hreflang alternates。

#### Scenario: Both translations are published
- **WHEN** 同一篇文章的繁中及英文版本皆已發布
- **THEN** 兩個頁面互相輸出 `zh-Hant` 與 `en` alternate URL

#### Scenario: Only one translation is published
- **WHEN** 文章只有一個語言版本已發布
- **THEN** 系統不輸出指向未發布翻譯的 alternate URL

### Requirement: Structured data
系統 SHALL 在文章頁輸出符合內容的 `Article` JSON-LD，並在作者頁輸出 `Person` JSON-LD。

#### Scenario: Article structured data is rendered
- **WHEN** 已發布文章頁完成伺服器渲染
- **THEN** JSON-LD 包含標題、描述、作者、發布日期、修改日期、主要圖片及 canonical URL

### Requirement: Search engine discovery
系統 SHALL 提供 sitemap 與 robots 規則。

#### Scenario: Sitemap is generated
- **WHEN** 搜尋引擎讀取 sitemap
- **THEN** sitemap 僅列出公開頁面及已發布的語言版本並包含最後修改時間

#### Scenario: Robots rules are generated
- **WHEN** 搜尋引擎讀取 robots.txt
- **THEN** 規則允許公開內容並禁止索引管理後台、API 與草稿預覽路徑

### Requirement: Index control
系統 SHALL 允許管理員將特定文章設為 `noindex`，並 SHALL 對草稿、預覽與搜尋結果頁使用 `noindex`。

#### Scenario: Article is marked noindex
- **WHEN** 管理員發布設為 `noindex` 的文章
- **THEN** 頁面可供訪客閱讀但輸出禁止索引指示且不列入 sitemap
