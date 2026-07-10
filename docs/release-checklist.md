# 上線與回歸檢查表

## 發布前

- [ ] `npm run deploy:validate`、`npm run quality`、`npm run test:e2e:ci` 全部成功
- [ ] Keystatic Cloud 只邀請核准作者，公開註冊關閉，未登入帳號無法寫入
- [ ] preview 回應含 `X-Robots-Tag: noindex, nofollow`
- [ ] 正式站 `/keystatic` 完成登入、建立草稿、圖片上傳、預覽、發布與下架測試
- [ ] 正式站首頁、文章、分類、標籤、搜尋、404、RSS、sitemap 與 robots 桌機／手機煙霧測試通過
- [ ] 草稿、下架與未來日期文章不存在於公開 URL、Pagefind、RSS、JSON-LD 與 sitemap
- [ ] Analytics 未設定／被阻擋時網站無錯；設定後只送出 allowlist 欄位
- [ ] Search Console 驗證完成並提交正式 sitemap

## 效能與 Web Vitals

CI 使用 Lighthouse 桌面設定跑三次，Performance、Accessibility、Best Practices 必須至少 95，SEO 必須 100。文章頁初始 JavaScript gzip 必須不超過 75 KB。

正式流量採不含搜尋字詞與法律個案資料的匿名彙總監控。每週依「首頁／文章／列表」頁型檢視行動與桌機第 75 百分位：

- LCP ≤ 2.5 秒
- INP ≤ 200 毫秒
- CLS ≤ 0.1

任一指標連續 7 天超標，建立效能回歸工作項目，先比較最近部署、圖片尺寸、第三方 script 與快取命中率；修正後以 CI lab data 與下一個 7 天 field data 共同驗證。樣本不足時不做個人層級判斷，只標記「資料不足」。

## 回滾

1. 停止將新 deployment 提升為 production。
2. 由託管平台把 production alias 指回上一個通過檢查的 immutable deployment。
3. 若是內容問題，在 Keystatic 將文章改為草稿／下架並重新部署；保留 Git 歷史，不直接破壞資料。
4. 重新驗證公開 URL、搜尋、RSS、sitemap、管理登入與安全標頭。
5. 記錄原因、影響時間、回滾版本與後續修正。
