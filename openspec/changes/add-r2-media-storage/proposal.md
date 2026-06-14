## Why

Vercel 的執行環境不適合永久保存 Payload 上傳的媒體檔案；目前寫入 `public/media` 的圖片可能在重新部署後遺失。上線前需要把正式環境的媒體改存到 Cloudflare R2，同時保留本機開發的檔案儲存方式。

## What Changes

- 正式環境可透過環境變數啟用 Cloudflare R2 媒體儲存。
- Payload 媒體檔案使用官方 S3 storage adapter 連接 R2。
- 對外媒體網址使用可設定的 `R2_PUBLIC_URL`，預定為 `https://media.tiwu.com`。
- 未設定完整 R2 參數時維持本機 `public/media` 儲存，不影響本機開發。
- Next.js Image 可載入設定的 R2 公開網域。
- 補充 R2 所需環境變數與部署設定說明。

## Capabilities

### New Capabilities

- `r2-media-storage`: 依環境安全切換本機媒體儲存與 Cloudflare R2，並產生正確的公開媒體網址。

### Modified Capabilities

無。

## Impact

- 影響 Payload plugin 設定、媒體 collection、Next.js Image 設定與環境變數文件。
- 新增與目前 Payload 版本一致的 `@payloadcms/storage-s3` 相依套件。
- 正式部署需要 Cloudflare R2 bucket、S3 API 憑證及公開自訂網域。
