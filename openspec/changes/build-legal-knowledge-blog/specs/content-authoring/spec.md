## ADDED Requirements

### Requirement: Administrator authentication
系統 SHALL 僅允許已驗證的管理員存取 Payload 管理後台及內容寫入操作。

#### Scenario: Unauthenticated visitor opens admin
- **WHEN** 未登入訪客開啟管理後台
- **THEN** 系統顯示登入畫面且不洩漏未發布內容

#### Scenario: Administrator signs in
- **WHEN** 管理員使用有效帳號密碼登入
- **THEN** 系統允許管理文章、分類、媒體與網站設定

### Requirement: Rich text post authoring
系統 SHALL 提供視覺化富文字編輯器，讓管理員編輯標題、摘要、內文、封面、分類、標籤及 SEO 欄位。

#### Scenario: Administrator creates a draft
- **WHEN** 管理員填寫文章內容並儲存但未發布
- **THEN** 系統保留草稿且公開網站不可讀取該文章

#### Scenario: Administrator previews a draft
- **WHEN** 管理員對草稿執行預覽
- **THEN** 系統以公開文章版型呈現草稿內容且不允許搜尋引擎索引

### Requirement: Manual publishing
系統 SHALL 支援管理員手動發布與取消發布文章，第一階段不提供排程發布。

#### Scenario: Administrator publishes a post
- **WHEN** 管理員發布已完成且已確認匿名化的文章
- **THEN** 系統使該語言版本出現在公開列表及文章網址

#### Scenario: Anonymous data confirmation is missing
- **WHEN** 管理員嘗試發布尚未勾選匿名化確認的文章
- **THEN** 系統拒絕發布並指出必要欄位

### Requirement: Media management
系統 SHALL 允許管理員上傳圖片並為圖片設定替代文字。

#### Scenario: Image is inserted into a post
- **WHEN** 管理員從媒體庫選擇圖片插入文章
- **THEN** 系統保存圖片關聯及可供無障礙與 SEO 使用的替代文字
