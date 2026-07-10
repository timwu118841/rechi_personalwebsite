# 法律實務筆記

個人法律經驗與實務觀察部落格，提供簡潔、易讀且適合行動裝置的閱讀體驗。

## 功能

- 文章發布、草稿與下架管理
- 自訂內容類型、文章分類與標籤
- 圖形化文章編輯後台
- 站內全文搜尋
- SEO、RSS 與 sitemap
- 隱私友善的流量分析整合

## 本機啟動

需要 Node.js 22.12 以上版本。

```bash
cp .env.example .env
npm install
npm run dev
```

- 網站：<http://localhost:4321>
- 管理後台：<http://localhost:4321/keystatic>

## 內容管理

後台分為：

- **內容編輯**：建立與編輯文章
- **內容設定**：管理內容類型與文章分類

文章必須設為「已發布」，且發布日期已到，才會顯示在公開網站。

## 常用指令

```bash
npm run dev       # 開發伺服器
npm run build     # 建立正式版本
npm run preview   # 預覽正式版本
npm run quality   # 執行品質檢查
npm run test:e2e  # 執行瀏覽器測試
```

## 免責聲明

本站內容僅為一般資訊與個人經驗分享，不構成針對特定個案的法律意見。
