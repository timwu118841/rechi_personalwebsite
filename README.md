# 法律筆記

以 Medium 式閱讀體驗為核心的雙語律師個人部落格。前台、Payload CMS 後台與內容 API 位於同一個 Next.js 專案。

## 架構

- **前台**：Next.js App Router、React、TypeScript
- **後台**：Payload CMS `/admin`
- **API**：Payload REST `/api/*`、GraphQL `/api/graphql`
- **資料庫**：PostgreSQL，正式環境建議使用 Neon
- **內容語言**：繁體中文 `zh-Hant`、英文 `en`
- **部署**：Vercel；正式媒體需接 Vercel Blob 或 S3 相容物件儲存

## 後台內容模型

- `users`：管理員登入
- `posts`：文章、草稿、富文字、雙語內容、分類、標籤、SEO、匿名化確認
- `categories`：家事民事、公司商務、案例與經驗、法律觀點
- `media`：圖片與雙語替代文字
- `site-settings`：網站名稱、作者資訊、SEO 預設描述與法律免責聲明

只有 `_status=published` 且目前語言有標題與 slug 的文章會出現在公開網站。英文版可以先保持空白，不會因此出現在英文網站。

## 本機啟動

需求：Node.js 20.9 以上、PostgreSQL。

```bash
cp .env.example .env
npm install
npm run dev
```

預設網址：

- 前台：http://localhost:3000/zh-Hant
- 英文：http://localhost:3000/en
- 後台：http://localhost:3000/admin

第一次開啟 `/admin` 時，Payload 會引導建立第一位管理員。請只建立自己的帳號。

## 初始化分類與網站設定

資料庫連線成功且 `.env` 已設定後執行：

```bash
npm run seed
```

這會建立四個雙語分類及可替換的作者／網站占位資料，不會建立示範文章。

## 發文流程

1. 登入 `/admin` 並新增文章。
2. 選擇右上角語言，分別填寫繁中或英文標題、摘要、slug、內文及 SEO。
3. 確認內容已移除可識別個案資訊，勾選「匿名化確認」。
4. 將文章狀態改為 Published。

文章頁固定顯示一般性法律資訊免責聲明；這不取代作者對實際內容與律師倫理規範的審查。

## 驗證

```bash
npm run generate:types
npm run generate:importmap
npm run lint
npx tsc --noEmit
npm run test:int
npm run build
openspec validate build-legal-knowledge-blog --strict
```

## 部署至 Vercel＋Neon

1. 在 Neon 建立 PostgreSQL database，複製 pooled connection string。
2. 將 Git repository 匯入 Vercel。
3. 設定環境變數：
   - `DATABASE_URL`
   - `PAYLOAD_SECRET`：至少 32 字元的隨機值
   - `PREVIEW_SECRET`
   - `NEXT_PUBLIC_SERVER_URL`：正式完整網址，不含尾斜線
4. 執行第一次部署，再開啟 `/admin` 建立管理員。
5. 在可信任環境連到正式資料庫執行 `npm run seed`。
6. 上傳圖片前，為 production 設定 Vercel Blob 或 S3 相容儲存；Vercel 執行環境的本機檔案不具持久性。

Vercel Hobby 官方定位為個人、非商業用途。若網站日後加入業務招攬、預約或其他商業功能，應重新確認並升級合適方案。

## 尚待後續設定

- 正式網域、律師姓名、網站名稱、Logo、品牌色及形象照
- Production 媒體儲存 provider
- 真實文章內容與關鍵字策略
