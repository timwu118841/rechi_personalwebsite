# 法律實務筆記

以 Astro 靜態優先架構打造的單一作者法律部落格。公開文章在建置時產生 HTML，由 CDN 直接提供；Keystatic 只負責受保護的內容管理，不會在讀者開啟文章時查詢 CMS 或資料庫。

## 第一版功能

- Medium 風格、繁體中文、行動裝置優先的閱讀介面
- 首頁、文章、分類、標籤、關於、搜尋與 404 頁
- Keystatic 圖形化管理後台：草稿、發布、下架、日期、圖片、可自訂內容類型與文章分類、標籤及 SEO 欄位
- 發布前個資匿名化與法律內容檢查
- 靜態 Pagefind 全文搜尋
- canonical、Open Graph、JSON-LD、sitemap、robots 與 RSS
- 可關閉的 Umami 相容流量分析
- 75 KB gzip 文章頁 JavaScript 預算、Axe／Playwright 與 Lighthouse CI 門檻

## 本機開發

需求：Node.js 24（最低支援 22.12；開發工具的最新版本建議使用 Node 24）。

```bash
cp .env.example .env
npm install
npm run dev
```

- 公開網站：<http://localhost:4321>
- 本機內容後台：<http://localhost:4321/keystatic>

本機未設定 `PUBLIC_KEYSTATIC_CLOUD_PROJECT` 時使用檔案模式，方便開發。正式建置若沒有 Cloud 設定，middleware 會讓 `/keystatic` 回傳 503，避免匿名管理介面誤上線。

### 不需要資料庫

這個架構沒有 SQLite、PostgreSQL、MongoDB 或其他資料庫。文章是 `src/content/articles/*/index.mdoc` 檔案，後台可管理的內容類型與分類分別是 `src/content/content-types/*.yaml`、`src/content/categories/*.yaml`。Astro 在 build 時讀取並產生公開 HTML；Pagefind 也在 build 後產生靜態搜尋索引。因此讀者瀏覽文章時不會查詢 CMS 或資料庫。

本機 Keystatic local mode 只會直接修改上述內容檔案與圖片檔：

```bash
cd rechi_personal_website_new
cp .env.example .env       # 第一次才需要
npm install                # 第一次才需要
npm run dev
```

停止伺服器按 `Ctrl+C`。若要檢查 production 產物：

```bash
npm run build
npm run preview
```

### `.omx` 與 `.codex` 是否提交？

目前已加入 `.gitignore`：

- `.omx/`：OMX session、狀態、日誌、PID 與本機執行資料，不應進 Git。
- `.codex/`：本機 Codex／agent skill 快取與執行設定，不是網站程式碼，也不應進 Git。

應該提交的是 `openspec/`、`src/`、`scripts/`、`public/`、`README.md` 與 CI 設定；不要用 `git add -f` 強制加入上述兩個目錄。若未來放入真正需要團隊共用的 Codex 專案規則，請另存成根目錄 `AGENTS.md` 或明確的文件，不要提交整個 `.codex/`。

## 作者發布流程

1. 登入 `/keystatic`。後台分為「內容編輯」與「內容設定」。
2. 若要新增「法律文章」「生活隨筆」「讀書筆記」這類用途，前往「內容設定 → 內容類型」建立類型；若要新增文章主題，前往「內容設定 → 文章分類」。
3. 前往「內容編輯 → 文章內容」，建立文章並填寫摘要、選取內容類型與分類、標籤、日期及內文；有圖片時提供替代文字。
4. 保持「草稿」即可儲存而不公開；使用格式化編輯器預覽內容。
5. 發布前勾選個資匿名化及「非個案法律意見」兩項檢查。
6. 狀態改成「已發布」後儲存。Keystatic Cloud 會把內容版本化到 GitHub，儲存庫 push 觸發 CI／部署。
7. 要撤下文章時改成「已下架」；下一次成功部署會自公開頁、搜尋、RSS 與 sitemap 移除，但內容仍保留在 Git 歷史與後台。

公開條件是「狀態為已發布，且發布日期不晚於建置時間」。訪客不能註冊或投稿。

「文章內容」「內容類型」「文章分類」是後台固定的資料模組，欄位結構仍由程式碼保護。Keystatic 不支援從後台動態建立全新的 schema 或側欄模組；日常擴充時可直接建立內容類型，達到新增「法律文章」「生活隨筆」等內容用途的效果，不需要修改程式碼。分類改名、說明、排序與顯示狀態會在下一次建置後同步到公開網站；類型與分類的代稱建立後應保持穩定。

## Keystatic Cloud 與正式部署

先在 Keystatic Cloud 建立專案、連接 GitHub 儲存庫並只邀請允許發文的帳號。正式環境設定：

```dotenv
SITE_URL=https://your-domain.example
PUBLIC_KEYSTATIC_CLOUD_PROJECT=team/project
KEYSTATIC_SECRET=至少 32 個字元的隨機秘密
PUBLIC_PREVIEW=false
```

部署前執行：

```bash
npm run deploy:validate
npm run quality
npm run test:e2e:ci
```

`@astrojs/node` 會輸出 `dist/client` 靜態資產與 `dist/server` 管理端 runtime。託管平台必須：

- 以 CDN 長時間快取 `dist/client` 的指紋化資產，HTML 採可重新驗證快取。
- 只將 `/keystatic/*` 與其 API 導向 Node server function，並保留 Keystatic Cloud 驗證流程。
- preview 設定 `PUBLIC_PREVIEW=true`；正式站為 `false`。
- secrets 只放平台環境變數，不能以 `PUBLIC_` 前綴或提交到儲存庫。
- 每次發布保留前一版 immutable deployment；失敗時由平台將 production alias 指回上一版。

實際平台與正式網域尚未指定，因此 CDN／function 路由需在選定平台後完成。詳見 [`docs/release-checklist.md`](docs/release-checklist.md)。

## SEO 與搜尋引擎收錄

1. 設定唯一正式 `SITE_URL` 與 `PUBLIC_GOOGLE_SITE_VERIFICATION`。
2. 部署後確認 `/robots.txt`、`/sitemap-index.xml`、`/rss.xml` 都是 200 且使用正式網域。
3. 在 Google Search Console 驗證網域資源。
4. 提交 `https://正式網域/sitemap-index.xml`，檢查 Page indexing 與 Core Web Vitals 報告。
5. 重要文章可使用 URL Inspection 要求重新建立索引；不要對 preview 網址送出索引要求。

技術 SEO 只能確保網站可抓取與理解，實際排名仍取決於內容品質、網站信任與時間。

## 流量分析與隱私

設定 `PUBLIC_UMAMI_WEBSITE_ID` 後，production 才會延後載入 Umami 相容程式；未設定或被阻擋時，網站功能不受影響。事件只允許：

### 啟用正式流量追蹤

建議先使用 Umami Cloud，不要在這個部落格專案內自架 Umami；自架 Umami 本身仍需要另外的資料庫。建立 Umami Cloud website 後取得 Website ID，將以下變數放到正式部署平台：

```dotenv
PUBLIC_UMAMI_WEBSITE_ID=你的-website-id
PUBLIC_UMAMI_SCRIPT_URL=https://cloud.umami.is/script.js
```

這兩個 `PUBLIC_` 變數必須在 `npm run build` **之前**設定，因為公開頁是靜態產物。設定完成後重新 build／deploy，再到 Umami dashboard 查看資料。可用瀏覽器 Network 檢查 `script.js` 與 `/api/send` 請求；若使用廣告阻擋器，請以未阻擋的瀏覽器驗證。

目前會自動收集一般 pageview，並額外記錄以下事件：

- `article_read`：文章 slug 與 25／50／75／90% 門檻
- `external_link`：目的地主機名稱
- `site_search`：結果筆數，不傳搜尋原文

預設方案採 Umami 的 cookie-free 模式，不使用廣告識別或跨站追蹤，因此此設定不啟用 cookie 同意橫幅。若日後更換成會設非必要 cookie 或跨站識別碼的供應商，必須在載入前加入同意與撤回流程，並重新檢視隱私聲明。

## 品質指令

```bash
npm run format:check
npm run lint
npm run check
npm test
npm run build
npm run test:e2e
npm audit
```

GitHub Actions 以 Node 24 執行完整品質、Playwright 與 Lighthouse 門檻。

## 尚需替換的站台資料

集中於 `src/config/site.ts` 與環境變數：正式網域、站名、作者姓名／簡介、聯絡方式、社群連結、品牌資產、分析 ID 與 Search Console 驗證碼。
