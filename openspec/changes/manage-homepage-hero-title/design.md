## Context

首頁已取得 `site-settings`，但主標題使用 `copy[locale].heroTitle`。新增欄位可直接沿用現有資料流。

## Goals / Non-Goals

**Goals:**

- 後台可分別設定中英文首頁主標題。
- 舊資料與空值仍顯示既有預設文案。
- `tagline` 繼續作為小標。

**Non-Goals:**

- 不新增首頁圖片設定。
- 不建立完整首頁版型編輯器。

## Decisions

- 欄位命名為 `homepageHeroTitle`，設為 `localized: true`。
- 欄位不設 `required`，以便舊資料自然回退。
- 首頁使用 `settings?.homepageHeroTitle || t.heroTitle`。

## Risks / Trade-offs

- 空字串會回退至預設文案，符合避免空白首頁的需求。

## Migration Plan

重新產生 Payload types。Payload 啟動時同步 global schema，無須手動建立欄位。
