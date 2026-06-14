## Context

Payload 目前把媒體寫入 `public/media`。這適合本機開發，但 Vercel 的檔案系統不是永久媒體儲存空間。Cloudflare R2 提供 S3 相容 API，可透過 Payload 官方 `@payloadcms/storage-s3` adapter 儲存檔案；公開讀取則使用未來綁定的 `https://media.tiwu.com`。

## Goals / Non-Goals

**Goals:**

- 設定完整 R2 環境變數時，Payload 媒體與衍生尺寸都寫入 R2。
- 資料庫內的媒體網址使用 `R2_PUBLIC_URL`，不暴露 S3 API endpoint。
- 未啟用 R2 時維持現有本機檔案儲存。
- Next.js Image 接受 R2 公開網域。
- 缺少部分 R2 參數時立即回報明確設定錯誤，避免誤以為已啟用雲端儲存。

**Non-Goals:**

- 不在程式內建立 R2 bucket、DNS 或 Cloudflare API token。
- 不自動搬移既有 `public/media` 檔案。
- 不在本次變更加入私有檔案、簽名下載或圖片轉檔服務。

## Decisions

1. **使用 Payload 官方 S3 adapter。** R2 提供 S3 相容 API，而此 adapter 適用於 Vercel 的 Node.js 環境。相較自行實作 storage adapter，可減少上傳、刪除與縮圖同步的維護成本。
2. **以完整設定決定是否啟用。** 所有 R2 變數皆未設定時採用本機儲存；只設定部分變數時丟出錯誤，避免正式環境靜默寫入 Vercel 暫存檔案。R2 region 依官方要求固定使用 `auto`，不增加容易填錯的環境變數。
3. **公開 URL 與上傳 endpoint 分離。** `R2_ENDPOINT` 僅供 S3 API 操作，`R2_PUBLIC_URL` 用於產生瀏覽器可讀網址。公開 URL 移除尾端斜線後再與檔名組合。
4. **Next.js 設定由同一公開 URL 產生 remote pattern。** 未設定 R2 時不加入 pattern，確保本機設定簡單且不接受不必要的遠端主機。
5. **保留 Media collection 的 `staticDir`。** adapter 未啟用時沿用既有本機行為；啟用後由 storage plugin 接管檔案儲存。

## Risks / Trade-offs

- [正式環境漏設 R2] → 部分設定直接中止啟動；部署檢查可立即看到缺少的變數。
- [公開網域尚未生效] → 上傳可成功但圖片暫時無法公開讀取；部署前需完成 `media.tiwu.com` 綁定。
- [既有本機媒體未在 R2] → 本次不自動搬移；上線前需重新上傳或另行執行一次性搬移。
- [Vercel 上傳大小限制] → 目前以律師部落格圖片為主要用途，先使用伺服器上傳；大型影片與 client uploads 不在本次範圍。

## Migration Plan

1. 部署程式但先不設定 R2 變數，本機行為維持不變。
2. 在 Cloudflare 建立 bucket、S3 API token，並將 `media.tiwu.com` 綁定為公開自訂網域。
3. 在 Vercel 設定完整 R2 變數後重新部署。
4. 從後台上傳測試圖片，確認原圖、縮圖、文章內圖片與 SEO 圖片皆使用公開網域。
5. 若需回復，移除 R2 環境變數並重新部署；新上傳會回到本機模式，但 Vercel 正式環境不應長期使用此回復狀態。

## Open Questions

無。`media.tiwu.com` 尚未申請不阻礙程式實作，實際部署前再完成 DNS 與 R2 自訂網域設定。
