## ADDED Requirements

### Requirement: Localized routes
系統 SHALL 以 `zh-Hant` 與 `en` URL 前綴提供繁體中文及英文網站。

#### Scenario: Visitor changes language
- **WHEN** 訪客在已有另一語言版本的頁面切換語言
- **THEN** 系統導向對應語言及相同內容的網址

#### Scenario: Corresponding translation is unavailable
- **WHEN** 訪客切換至尚未發布對應內容的語言
- **THEN** 系統導向該語言首頁而非顯示其他語言內容

### Requirement: Independent localized content
系統 SHALL 讓管理員分別維護繁中與英文的標題、摘要、slug、內文及 SEO 欄位。

#### Scenario: Chinese post has no English translation
- **WHEN** 管理員發布繁中內容但英文內容仍為空白草稿
- **THEN** 系統只公開繁中網址且不建立可索引的英文文章頁

#### Scenario: English translation is published
- **WHEN** 管理員完成並發布英文翻譯
- **THEN** 系統公開英文網址並建立繁中與英文互相對應關係

### Requirement: Localized interface
系統 SHALL 依 URL 語言顯示相應的導覽、分類名稱、日期格式、搜尋及免責聲明。

#### Scenario: Visitor views English interface
- **WHEN** 訪客開啟 `/en` 下的頁面
- **THEN** 系統以英文顯示所有介面文字
