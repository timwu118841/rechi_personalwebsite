## Context

`article_sources` 目前的 `state` 只有 Notion 端的事實：`onboarding`／`active`／`error`／`archived`，其中 `archived` 由 `in_trash` 推導。同步流程每次都會用 Notion 的狀態覆寫這一欄（`src/lib/content-jobs/service.ts` 的 `syncSource`）。因此「作者不想再看到這一列」是一個新的、與 Notion 無關的維度，不能塞進 `state`。

## Goals / Non-Goals

**Goals**

- 作者能讓一個已同步來源停止參與同步與發布流程，且隨時可復原。
- 忽略不影響已發布文章、公開前台、既有 revision 與 working copy。
- 資料庫層擋住「為已忽略來源建立發布候選」，與既有 `state` 檢查同一邊界。
- 支援批次操作，因為需要清理的清單通常一次出現數十列。

**Non-Goals**

- 不提供硬刪除（`article_source_revisions`／`article_working_copies`／`publication_candidates` 對來源是 `on delete restrict`）。
- 不自動下架已發布文章；下架仍由 `unpublish_article` 負責。
- 不新增「忽略後自動重新同步」的排程；復原後由使用者手動同步或下一次 discovery 接手。

## Decisions

### 用新的 `ignored_at` 欄位，而不是 `state = 'archived'` 或 `'paused'`

`archived` 由 Notion 的 `in_trash` 推導，`paused` 雖在 constraint 內但目前沒有任何寫入者。兩者都會被 `syncSource` 覆寫（它一律把 state 寫成 `archived` 或 `active`），因此作者意圖會在下一次同步被無聲清掉。新增 `ignored_at timestamptz` 讓「作者意圖」與「Notion 事實」各自獨立，`state` 維持由 Notion 決定。

### 軟刪除，不硬刪除

來源底下有不可變 revision、working copy、候選與已發布文章，硬刪除會破壞審計軌跡且不可復原。忽略只寫一個時間戳，復原就是把它設回 null，成本最低、風險最小。

### 發布邊界放在 RPC

`prepare_publication_candidate` 已經在資料庫層檢查 `state not in ('onboarding','active')`；把 `ignored_at is not null` 的檢查加在同一個位置，避免出現「TS 檢查一次、SQL 檢查另一套」的第二種慣例。同名函式以 `create or replace` 取代（複製 `202607150003_notion_direct_publication.sql` 的最新版本 + 一行檢查），維持既有 pattern。

### 同步排除的兩道防線

1. **計畫階段**：`planDataSourceSync` 不為已忽略來源產生目標，因此不會排入新 job。
2. **執行階段**：`syncSource` 在讀取 Notion 前先確認來源未被忽略。若忽略發生在 job 已排入之後（或由直接同步觸發），該 job 以明確錯誤結束，不會寫入 revision。

### 忽略時一併取消排隊工作與未上線候選

`content_jobs.state = 'cancelled'`（需同時填 `completed_at`）與 `publication_candidates.state = 'cancelled'`（需 `cancelled_at`、`failure_reason`）都是既有合法的狀態轉移，`unpublish_article` 已示範同樣的取消寫法。只處理 `queued` job，正在跑的工作讓它自然結束——`syncSource` 的守門會讓它無害失敗。

### 批次上限 200 且全有全無

RPC 先驗證所有 id 都存在，任何一個不存在就整批拒絕，避免部分成功的模糊狀態。上限 200 讓單次交易維持在合理範圍。

## Risks / Trade-offs

- **忽略後 Notion 頁面被編輯**：不會有任何反應，直到使用者復原。這是預期行為（忽略的定義就是停止追蹤），但復原後第一次需要手動「同步 Notion 最新內容」才會取得最新內容，因為 discovery 會依 `last_edited_time` 判斷未變更而跳過。
- **忽略期間 Notion 頁面被刪除**：復原後該來源會由 discovery 或手動同步推導為 `archived`。
- **`ignored_at` 不進 `state`**：`StatusBadge` 需要另外呈現忽略狀態，不能只靠 `state`。
