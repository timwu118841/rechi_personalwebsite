## ADDED Requirements

### Requirement: Chinese slug generation
系統 SHALL 保留標題中的中文字元並產生可用 slug。

#### Scenario: Chinese article title
- **WHEN** 標題為 `離婚財產怎麼分`
- **THEN** 自動 slug 為 `離婚財產怎麼分`

### Requirement: Separator normalization
系統 SHALL 將空白與標點區段轉成單一連字號，並移除頭尾連字號。

#### Scenario: Mixed punctuation and spaces
- **WHEN** 標題為 `公司／股東 爭議！`
- **THEN** 自動 slug 為 `公司-股東-爭議`

### Requirement: Shared document behavior
文章與固定頁面 SHALL 使用相同 Unicode slug 規則。

#### Scenario: Administrator creates content
- **WHEN** 管理員以中文標題建立文章或固定頁面
- **THEN** 兩種內容皆可自動取得非空白中文 slug

### Requirement: Existing slug preservation
系統 MUST NOT 主動改寫既有已發布內容的 slug。

#### Scenario: Feature deployment
- **WHEN** 新規則部署至已有內容的網站
- **THEN** 既有 slug 保持原值
