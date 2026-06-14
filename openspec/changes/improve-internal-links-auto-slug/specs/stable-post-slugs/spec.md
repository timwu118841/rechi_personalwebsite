## ADDED Requirements

### Requirement: Automatic localized slug generation
系統 SHALL 在建立文章及草稿編輯期間，依目前語系的標題自動產生 slug。

#### Scenario: Administrator creates a draft
- **WHEN** 管理員輸入文章標題且尚未手動覆寫 slug
- **THEN** 系統自動產生同語系 slug

### Requirement: Stable published slug
系統 MUST 在文章發布後停止因標題變更而自動修改 slug。

#### Scenario: Published title changes
- **WHEN** 管理員修改已發布文章的標題並儲存
- **THEN** 原本 slug 維持不變

### Requirement: Manual slug override
系統 SHALL 允許管理員明確修改自動產生的 slug，且修改後停止自動覆寫。

#### Scenario: Administrator chooses a custom slug
- **WHEN** 管理員輸入自訂 slug
- **THEN** 後續草稿標題變更不覆寫該自訂 slug

### Requirement: Existing slug preservation
系統 MUST 保留部署前已存在文章的 slug。

#### Scenario: Migration runs with existing posts
- **WHEN** production migration 套用至已有文章的資料庫
- **THEN** 現有 slug 值不被重新產生或清除
