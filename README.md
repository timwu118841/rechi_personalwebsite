# 法律筆記

以 Medium 式閱讀體驗為核心的雙語律師個人部落格。前台、Payload CMS 後台與內容 API 位於同一個 Next.js 專案。

## 架構

- **前台**：Next.js App Router、React、TypeScript
- **後台**：Payload CMS `/admin`
- **API**：Payload REST `/api/*`、GraphQL `/api/graphql`
- **資料庫**：PostgreSQL，正式環境建議使用 Neon
- **內容語言**：繁體中文 `zh-Hant`、英文 `en`
- **部署**：Vercel；正式媒體使用 Cloudflare R2

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
   - `CRON_SECRET`
   - `NEXT_PUBLIC_SERVER_URL`：正式完整網址，不含尾斜線
4. 依下方說明設定 Cloudflare R2。
5. 執行第一次部署，再開啟 `/admin` 建立管理員。
6. 在可信任環境連到正式資料庫執行 `npm run seed`。

Vercel Hobby 官方定位為個人、非商業用途。若網站日後加入業務招攬、預約或其他商業功能，應重新確認並升級合適方案。

### Cloudflare R2 與 `media.tiwu.com`

1. 在 Cloudflare 建立 R2 bucket，例如 `rechi-legal-media`。
2. 建立只允許此 bucket 讀寫的 R2 S3 API token，取得 Access Key ID 與 Secret Access Key。
3. 在 bucket 的 **Settings → Custom Domains** 綁定 `media.tiwu.com`。`tiwu.com` 必須位於同一個 Cloudflare 帳號；子網域不需要另外購買。
4. 等待 Custom Domain 狀態成為 Active。
5. 在 Vercel 的 Production 環境設定：

```env
R2_BUCKET=rechi-legal-media
R2_ENDPOINT=https://你的_CLOUDFLARE_ACCOUNT_ID.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=你的_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY=你的_SECRET_ACCESS_KEY
R2_PUBLIC_URL=https://media.tiwu.com
```

R2 的 region 由程式固定為 `auto`，不用另外設定。五個 R2 變數必須全部設定；若只填其中一部分，網站會在啟動或建置時顯示缺少哪些設定。未設定任何 R2 變數時，本機仍會把圖片寫入 `public/media`。

完成部署後，請從 `/admin` 上傳一張測試圖片，確認原圖與縮圖網址皆以 `https://media.tiwu.com/` 開頭。既有 `public/media` 圖片不會自動搬到 R2，需要重新上傳或另外執行搬移。

## 尚待後續設定

- 正式網域、律師姓名、網站名稱、Logo、品牌色及形象照
- 真實文章內容與關鍵字策略
