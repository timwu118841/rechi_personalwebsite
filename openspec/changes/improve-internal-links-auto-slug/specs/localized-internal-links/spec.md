## ADDED Requirements

### Requirement: Editable internal links
系統 SHALL 使用 Payload 支援的站內連結欄位，讓管理員可在文章編輯器新增及修改文章或固定頁面連結。

#### Scenario: Administrator edits an existing internal link
- **WHEN** 管理員選取或開啟文章內容中的既有站內連結
- **THEN** 編輯器顯示目前目標並允許改選其他文章或固定頁面

### Requirement: Locale-aware article links
系統 SHALL 以目前公開文章的語系產生站內文章連結，並 MUST 包含 `/posts/` 路徑。

#### Scenario: English article links to another article
- **WHEN** 英文文章內容連結至 slug 為 `company-law` 的文章
- **THEN** 前台連結網址為 `/en/posts/company-law`

#### Scenario: Traditional Chinese article links to another article
- **WHEN** 繁體中文文章內容連結至 slug 為 `家事法律` 的文章
- **THEN** 前台連結網址為 `/zh-Hant/posts/%E5%AE%B6%E4%BA%8B%E6%B3%95%E5%BE%8B`

### Requirement: Locale-aware page links
系統 SHALL 以目前公開文章的語系產生站內固定頁面連結。

#### Scenario: Article links to a fixed page
- **WHEN** 英文文章內容連結至 slug 為 `about` 的固定頁面
- **THEN** 前台連結網址為 `/en/about`
