## ADDED Requirements

### Requirement: Controlled text colors
系統 SHALL 讓管理員從 16 種固定專業色彩中設定文章文字顏色，且 MUST NOT 接受任意色碼。

#### Scenario: Administrator colors selected text
- **WHEN** 管理員選取文章文字並選擇固定色盤中的顏色
- **THEN** 編輯器保存色彩狀態，公開文章以對應白名單色碼呈現

### Requirement: Detailed font sizes
系統 SHALL 提供 12、14、16、18、20、24、28、32、36、40px 十種文章字級。

#### Scenario: Administrator changes selected text size
- **WHEN** 管理員選取文字並選擇其中一個固定字級
- **THEN** 編輯器保存字級狀態，公開文章以對應尺寸呈現

### Requirement: Extended formatting tools
系統 SHALL 提供底線、刪除線、對齊、項目清單、編號清單、引用、縮排、上標與下標，並保留既有標題、連結、圖片、提示框、程式碼與分隔線功能。

#### Scenario: Administrator formats a legal article
- **WHEN** 管理員使用文章編輯器整理長篇內容
- **THEN** 可使用完整排版工具建立內容層次且不需輸入 HTML

### Requirement: Safe public rendering
系統 MUST 僅將已定義的字色與字級狀態轉換為前台樣式，未知狀態 MUST 被忽略。

#### Scenario: Article contains an unknown text state
- **WHEN** 公開頁面渲染不在白名單內的色彩或字級鍵
- **THEN** 系統顯示文字內容但不輸出該未知樣式

### Requirement: Existing article compatibility
系統 SHALL 在不轉換既有文章資料的情況下維持原有文章顯示。

#### Scenario: Existing article has no text style state
- **WHEN** 公開頁面渲染升級前建立的文章
- **THEN** 文章沿用原本版型與格式正常顯示
