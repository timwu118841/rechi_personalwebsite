# 管理後台文章編輯器強化設計

## 目標

強化 Payload 管理後台的文章內容編輯器，提供更完整但不擁擠的排版工具。管理員可使用固定專業色盤與細分字級，前台文章必須正確呈現相同格式，且既有文章不需轉換。

## 使用者介面

採用「精簡工具列＋更多選單」：

- 主要工具列固定顯示：
  - 段落／標題格式
  - 字級
  - 字體顏色
  - 粗體
  - 斜體
  - 更多工具
- 更多工具提供：
  - 底線
  - 刪除線
  - 靠左、置中、靠右、左右對齊
  - 項目清單、編號清單
  - 引用區塊
  - 增加縮排、減少縮排
  - 清除文字樣式
  - 上標、下標
  - 復原、重做
- 保留目前功能：
  - H1、H2、H3、H4
  - 連結
  - 水平分隔線
  - 圖片
  - 提示框
  - 程式碼區塊

Payload 內建工具列會依可用寬度排列群組；「精簡」以常用功能優先與下拉群組實現，不建立整套自製編輯器框架。

## 字級

提供以下固定選項：

| 名稱 | CSS |
|---|---|
| 12px | `font-size: 12px` |
| 14px | `font-size: 14px` |
| 16px | `font-size: 16px` |
| 18px | `font-size: 18px` |
| 20px | `font-size: 20px` |
| 24px | `font-size: 24px` |
| 28px | `font-size: 28px` |
| 32px | `font-size: 32px` |
| 36px | `font-size: 36px` |
| 40px | `font-size: 40px` |

「預設樣式」會移除自訂字級，回到文章版型的預設尺寸。前台在窄螢幕對 28px 以上字級套用響應式上限，避免文字超出版面；後台儲存值仍維持原設定。

## 固定字體色盤

提供 16 種具辨識度的專業色彩：

| 名稱 | 色碼 |
|---|---|
| 墨黑 | `#111827` |
| 深灰 | `#374151` |
| 灰色 | `#6B7280` |
| 淺灰 | `#9CA3AF` |
| 藏青 | `#172554` |
| 藍色 | `#1D4ED8` |
| 湖藍 | `#0369A1` |
| 青色 | `#0891B2` |
| 酒紅 | `#7F1D1D` |
| 紅色 | `#DC2626` |
| 橘色 | `#C2410C` |
| 金棕 | `#A16207` |
| 深綠 | `#14532D` |
| 綠色 | `#15803D` |
| 深紫 | `#581C87` |
| 紫色 | `#7E22CE` |

不提供任意色碼輸入，避免低對比文字及品牌視覺失控。「預設樣式」會移除自訂顏色。

## 技術設計

### 編輯器設定

- 將文章專用 Lexical features 抽成單一設定模組，避免 `Posts` collection 持續膨脹。
- 使用 Payload 3.85.1 的內建功能：
  - `TextStateFeature` 儲存固定 `color` 與 `fontSize` 狀態。
  - `AlignFeature`、`IndentFeature`、`UnorderedListFeature`、`OrderedListFeature`、`BlockquoteFeature`。
  - `UnderlineFeature`、`StrikethroughFeature`、`SubscriptFeature`、`SuperscriptFeature`。
  - 既有 `HeadingFeature`、`BlocksFeature`、`HorizontalRuleFeature` 與工具列。
- 復原與重做沿用 Lexical 內建歷程與鍵盤快捷鍵；若 Payload 目前版本未提供可配置的固定工具列按鈕，不為兩個按鈕引入自製 editor plugin。
- 清除格式使用 `TextStateFeature` 下拉選單的「預設樣式」清除字色與字級；一般粗斜體等格式可再次切換取消。

### 儲存格式

`TextStateFeature` 只在文字節點保存狀態鍵和值，例如顏色名稱與字級名稱，不把任意 inline CSS 寫入資料。色碼與實際 CSS 集中在設定模組，因此未來可調整色盤呈現而不需要修改文章 JSON。

### 前台渲染

Payload 預設 JSX 文字 converter 不會自動套用 `TextStateFeature` 的狀態，因此前台 `RichText` 必須加入受控的文字 converter：

1. 只接受設計中定義的顏色與字級鍵。
2. 將鍵映射為白名單中的 React inline style。
3. 保留粗體、斜體、底線、刪除線、上標、下標與行內程式碼。
4. 未知或舊狀態值直接忽略，不產生任意 CSS。

對齊與縮排沿用 Payload 預設 JSX converter。文章 CSS 補上清單、引用與響應式大字級規則。

## 相容性與安全

- 既有文章沒有文字狀態資料，繼續使用原本版型，不需 migration。
- 色彩與字級採白名單映射，前台不信任文章 JSON 中的任意 CSS。
- 不新增第三方套件；使用專案既有 Payload Lexical 版本。
- `TextStateFeature` 在 Payload 3.85.1 標示為 experimental，因此設定集中於單一模組，降低未來 Payload 升級的修改面。

## 測試與驗證

- 設定測試：
  - 文章 editor 註冊字色、字級與指定排版 features。
  - 固定色盤恰為 16 色。
  - 字級恰為 10 種且限制在 12–40px。
- 前台 converter 測試：
  - 合法字色與字級正確輸出。
  - 合法狀態可與粗體、底線等格式同時呈現。
  - 未知狀態不輸出 style。
- 回歸驗證：
  - 既有文章節點仍可渲染。
  - Payload types 與 import map 可重新產生。
  - 完整 integration tests、TypeScript、ESLint 與 production build 通過。

## 不包含項目

- 不提供任意字體家族選擇。
- 不提供任意色碼或背景色。
- 不加入表格、嵌入影片或第三方文件元件。
- 不修改文章前台整體視覺設計。
