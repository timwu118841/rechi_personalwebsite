## ADDED Requirements

### Requirement: Blog-focused administration
系統 SHALL 僅在管理後台提供目前法律部落格所需的內容管理功能，且 MUST NOT 註冊訪客表單或表單回覆 collections。

#### Scenario: Administrator opens the dashboard
- **WHEN** 管理員登入 Payload 後台
- **THEN** 後台不顯示「表單」或「表單回覆」管理項目

### Requirement: Form-free page composition
系統 SHALL 讓管理員以內容、媒體、文章封存及行動呼籲區塊組成固定頁面，且 MUST NOT 提供表單區塊。

#### Scenario: Administrator edits a fixed page
- **WHEN** 管理員新增固定頁面的版面區塊
- **THEN** 可選區塊中不包含訪客表單

### Requirement: No public form submission endpoint
系統 MUST NOT 提供未使用的 Payload 表單回覆 API。

#### Scenario: Application configuration loads
- **WHEN** Payload 根據目前設定註冊 collections 與 API
- **THEN** 系統不註冊 `forms` 或 `form-submissions` 端點
