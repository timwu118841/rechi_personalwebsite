# 法律實務筆記

以 Astro、Supabase 與 Vercel 建立的個人法律經驗部落格。文章、網站標題、作者簡介與圖片可從受保護後台即時更新，不需要為每篇文章重新部署。

## 本機啟動

需要 Node.js 22.12 以上版本。

```bash
cp .env.example .env
npm install
npm run dev
```

- 網站：<http://localhost:4321>
- 管理後台：<http://localhost:4321/admin>

沒有設定 Supabase 時，公開網站會使用 `src/content` 的唯讀示範文章；後台會顯示資料庫設定提示。

## 啟用即時內容後台

1. 建立 Supabase project。
2. 依序在 SQL Editor 執行 `supabase/migrations/` 下的 migration（包含 `202607110004_admin_users.sql`）。
3. 在 Supabase Authentication 啟用 Google provider，並將 Google Cloud OAuth redirect URI 設為 `https://<project-ref>.supabase.co/auth/v1/callback`；Supabase Redirect URLs 加入本機與正式站的 `/admin` URL。
4. 將 `.env.example` 的 Supabase 變數填入 `.env`；正式站也要在 Vercel 設定相同環境變數。管理權限不再由部署環境變數控制，而是由 `public.admin_users` 資料表控制。
5. Google 是預設登入方式；相容期可用 `PUBLIC_ADMIN_PASSWORD_LOGIN=true` 保留密碼登入，設為 `false` 即停用。
6. 如需匯入目前的示範文章，執行 `npm run content:import`。

### 管理者安全佈署與增刪

先在 Supabase Authentication 建立並驗證使用者，再以 SQL Editor 使用該使用者 UUID 建立管理成員：

```sql
insert into public.admin_users (user_id, email)
select id, lower(email)
from auth.users
where email = 'admin@example.com'
on conflict (user_id) do update set email = excluded.email, updated_at = now();
```

移除管理權限時刪除 `public.admin_users` 對應列；不要把 `SUPABASE_SECRET_KEY` 或管理成員查詢放進瀏覽器。migration 應先套用、再建立管理列，回滾時保留資料表並先移除成員列。

`SUPABASE_SECRET_KEY` 只能放在本機或 Vercel server environment，不可加上 `PUBLIC_`，也不可放進瀏覽器程式。

## 常用指令

```bash
npm run dev              # 開發伺服器
npm run build            # 建立 Vercel server output
npm run quality          # format、lint、型別、測試與 build
npm run test:e2e         # 瀏覽器測試
npm run deploy:validate  # 驗證正式環境變數
```

正式部署前的操作順序與回滾方式請見 `docs/release-checklist.md`。

## 免責聲明

本站內容僅為一般資訊與個人經驗分享，不構成針對特定個案的法律意見。
