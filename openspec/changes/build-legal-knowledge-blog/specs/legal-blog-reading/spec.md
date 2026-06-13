## ADDED Requirements

### Requirement: Article discovery homepage
系統 SHALL 提供以文章探索為主的首頁，顯示精選內容、最新文章及主要分類。

#### Scenario: Visitor opens homepage
- **WHEN** 訪客開啟某一語言的首頁
- **THEN** 系統僅顯示該語言已發布文章並提供分類與搜尋入口

### Requirement: Focused article reading
系統 SHALL 以窄欄、清楚字級與低干擾介面呈現長篇文章。

#### Scenario: Visitor opens an article
- **WHEN** 訪客開啟已發布文章
- **THEN** 系統顯示標題、摘要、作者、發布及修改日期、閱讀時間、分類、內文與免責聲明

#### Scenario: Visitor opens an unpublished article
- **WHEN** 訪客開啟不存在或未發布的文章網址
- **THEN** 系統回應找不到頁面且不顯示草稿內容

### Requirement: Category browsing
系統 SHALL 提供依分類瀏覽文章的頁面。

#### Scenario: Visitor selects a category
- **WHEN** 訪客選擇家事民事、公司商務、案例與經驗或法律觀點分類
- **THEN** 系統顯示目前語言下屬於該分類的已發布文章

### Requirement: On-site search
系統 SHALL 允許訪客依目前語言搜尋已發布文章的標題及摘要。

#### Scenario: Search has matches
- **WHEN** 訪客輸入可匹配文章標題或摘要的關鍵字
- **THEN** 系統顯示依發布日期排序的結果

#### Scenario: Search has no matches
- **WHEN** 訪客輸入沒有匹配文章的關鍵字
- **THEN** 系統顯示無結果狀態且保留搜尋詞

### Requirement: Author information
系統 SHALL 提供作者介紹頁及文章內的精簡作者資訊。

#### Scenario: Visitor opens author page
- **WHEN** 訪客開啟作者介紹頁
- **THEN** 系統顯示可由後台設定的作者姓名、專業領域、簡介及照片占位
