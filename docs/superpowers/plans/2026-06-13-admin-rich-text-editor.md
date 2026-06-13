# 管理後台文章編輯器強化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 為文章編輯器加入固定 16 色、12–40px 細分字級及完整排版工具，並讓前台安全呈現相同格式。

**Architecture:** 將文章專用 Lexical 設定與文字樣式白名單集中於 `src/fields/postEditor.ts`。後台使用 Payload 內建 `TextStateFeature` 與排版 features；前台以獨立文字 converter 解析 Lexical node state，只映射允許的顏色與字級。

**Tech Stack:** Next.js 16、Payload CMS 3.85.1、Payload Lexical、React 19、TypeScript、Vitest

---

### Task 1: 建立 OpenSpec change

**Files:**
- Create: `openspec/changes/enhance-post-editor/proposal.md`
- Create: `openspec/changes/enhance-post-editor/design.md`
- Create: `openspec/changes/enhance-post-editor/specs/rich-text-authoring/spec.md`
- Create: `openspec/changes/enhance-post-editor/tasks.md`

- [ ] **Step 1: 建立 change**

Run:

```bash
openspec new change enhance-post-editor
```

Expected: 建立 `openspec/changes/enhance-post-editor/`。

- [ ] **Step 2: 產生 proposal、design、specs、tasks**

內容必須引用已核准設計：

```text
docs/superpowers/specs/2026-06-13-admin-rich-text-editor-design.md
```

規格情境至少包含：固定色盤、固定字級、完整排版工具、前台安全渲染、既有文章相容。

- [ ] **Step 3: 驗證 change**

Run:

```bash
openspec validate enhance-post-editor --type change --strict --no-interactive
```

Expected: `Change 'enhance-post-editor' is valid`

### Task 2: 以測試鎖定編輯器設定

**Files:**
- Create: `src/fields/postEditor.ts`
- Modify: `tests/int/blog-admin-config.int.spec.ts`

- [ ] **Step 1: 先寫失敗測試**

加入測試，期待尚未存在的匯出：

```ts
import {
  postEditorFeatures,
  postFontSizeStyles,
  postTextColorStyles,
} from '@/fields/postEditor'

expect(Object.keys(postTextColorStyles)).toHaveLength(16)
expect(Object.keys(postFontSizeStyles)).toEqual([
  '12px', '14px', '16px', '18px', '20px',
  '24px', '28px', '32px', '36px', '40px',
])
expect(postEditorFeatures.map((feature) => feature.key)).toEqual(
  expect.arrayContaining([
    'align',
    'blockquote',
    'indent',
    'orderedList',
    'strikethrough',
    'subscript',
    'superscript',
    'textState',
    'underline',
    'unorderedList',
  ]),
)
```

- [ ] **Step 2: 執行 RED**

Run:

```bash
npm run test:int -- tests/int/blog-admin-config.int.spec.ts
```

Expected: FAIL，因為 `@/fields/postEditor` 尚未存在。

- [ ] **Step 3: 建立集中式設定**

`src/fields/postEditor.ts` 匯出：

```ts
export const postTextColorStyles = {
  ink: { label: '墨黑', css: { color: '#111827' } },
  charcoal: { label: '深灰', css: { color: '#374151' } },
  gray: { label: '灰色', css: { color: '#6B7280' } },
  silver: { label: '淺灰', css: { color: '#9CA3AF' } },
  navy: { label: '藏青', css: { color: '#172554' } },
  blue: { label: '藍色', css: { color: '#1D4ED8' } },
  lake: { label: '湖藍', css: { color: '#0369A1' } },
  cyan: { label: '青色', css: { color: '#0891B2' } },
  wine: { label: '酒紅', css: { color: '#7F1D1D' } },
  red: { label: '紅色', css: { color: '#DC2626' } },
  orange: { label: '橘色', css: { color: '#C2410C' } },
  gold: { label: '金棕', css: { color: '#A16207' } },
  forest: { label: '深綠', css: { color: '#14532D' } },
  green: { label: '綠色', css: { color: '#15803D' } },
  plum: { label: '深紫', css: { color: '#581C87' } },
  purple: { label: '紫色', css: { color: '#7E22CE' } },
} as const
```

字級設定：

```ts
export const postFontSizeStyles = Object.fromEntries(
  ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '40px']
    .map((size) => [size, { label: size, css: { 'font-size': size } }]),
)
```

建立 `postEditorFeatures`，包含設計指定的 Payload features、既有 blocks、固定工具列與 inline toolbar。

- [ ] **Step 4: 執行 GREEN**

Run:

```bash
npm run test:int -- tests/int/blog-admin-config.int.spec.ts
```

Expected: PASS。

### Task 3: 將文章 collection 接上新編輯器

**Files:**
- Modify: `src/collections/Posts/index.ts`
- Modify: `tests/int/blog-admin-config.int.spec.ts`

- [ ] **Step 1: 加入失敗測試**

從 `Posts.fields` 找出 `content` rich text field，確認其 editor features 包含 `textState` 與指定排版 features。

- [ ] **Step 2: 執行 RED**

Run:

```bash
npm run test:int -- tests/int/blog-admin-config.int.spec.ts
```

Expected: FAIL，因為 `Posts` 仍使用舊的 inline editor 設定。

- [ ] **Step 3: 替換 Posts editor**

將 `src/collections/Posts/index.ts` 的 Lexical feature imports 與 inline `lexicalEditor` 設定改為：

```ts
import { postEditor } from '@/fields/postEditor'
```

並設定：

```ts
editor: postEditor
```

- [ ] **Step 4: 執行 GREEN**

Run:

```bash
npm run test:int -- tests/int/blog-admin-config.int.spec.ts
```

Expected: PASS。

### Task 4: 建立安全的前台文字樣式 converter

**Files:**
- Create: `src/lib/rich-text-style.tsx`
- Create: `tests/int/blog-rich-text.int.spec.ts`
- Modify: `src/components/RichText/index.tsx`

- [ ] **Step 1: 寫 converter 失敗測試**

測試合法 node state：

```ts
const node = {
  type: 'text',
  text: '重要內容',
  format: 1 | 8,
  $: { color: 'wine', fontSize: '24px' },
}
```

期待靜態 HTML 同時包含：

```text
color:#7F1D1D
font-size:24px
<strong>
text-decoration:underline
```

另測試 `$: { color: 'javascript:bad', fontSize: '999px' }` 不輸出任意 style。

- [ ] **Step 2: 執行 RED**

Run:

```bash
npm run test:int -- tests/int/blog-rich-text.int.spec.ts
```

Expected: FAIL，因為安全 converter 尚未存在。

- [ ] **Step 3: 實作白名單 converter**

`src/lib/rich-text-style.tsx` 匯出：

```ts
export function resolvePostTextStyle(node: StyledTextNode): React.CSSProperties
export const StyledTextJSXConverter: JSXConverter<StyledTextNode>
```

`resolvePostTextStyle` 只能從 `postTextColorStyles`、`postFontSizeStyles` 取得 CSS。converter 依 Lexical format bitmask 套用 `strong`、`em`、`span`、`code`、`sub`、`sup`。

- [ ] **Step 4: 接上 RichText converters**

在 `src/components/RichText/index.tsx` 的 converters 加入：

```ts
text: StyledTextJSXConverter,
```

- [ ] **Step 5: 執行 GREEN**

Run:

```bash
npm run test:int -- tests/int/blog-rich-text.int.spec.ts
```

Expected: PASS。

### Task 5: 補上文章閱讀樣式

**Files:**
- Modify: `src/app/(frontend)/globals.css`
- Modify: `tests/int/blog-rich-text.int.spec.ts`

- [ ] **Step 1: 加入響應式標記測試**

合法大字級 converter 應輸出：

```html
data-font-size="40px"
```

- [ ] **Step 2: 執行 RED**

Run:

```bash
npm run test:int -- tests/int/blog-rich-text.int.spec.ts
```

Expected: FAIL，因 converter 尚未輸出 `data-font-size`。

- [ ] **Step 3: 輸出 data attribute 並加入 CSS**

converter 對合法字級輸出 `data-font-size`。在 `globals.css` 加入：

```css
.article-body blockquote {
  border-inline-start: 4px solid var(--accent);
  color: var(--muted);
  margin: 2rem 0;
  padding-inline-start: 1.25rem;
}

@media (max-width: 640px) {
  .article-body [data-font-size='28px'],
  .article-body [data-font-size='32px'],
  .article-body [data-font-size='36px'],
  .article-body [data-font-size='40px'] {
    font-size: clamp(1.5rem, 7vw, 2rem) !important;
  }
}
```

- [ ] **Step 4: 執行 GREEN**

Run:

```bash
npm run test:int -- tests/int/blog-rich-text.int.spec.ts
```

Expected: PASS。

### Task 6: 產生檔與完整驗證

**Files:**
- Modify: `src/payload-types.ts`
- Modify if generated: `src/app/(payload)/admin/importMap.js`
- Modify: `openspec/changes/enhance-post-editor/tasks.md`

- [ ] **Step 1: 重新產生 Payload artifacts**

Run:

```bash
npm run generate:types
npm run generate:importmap
```

Expected: 兩個指令 exit 0。

- [ ] **Step 2: 執行完整檢查**

Run:

```bash
npm run test:int
npx tsc --noEmit
npm run lint
npm run build
openspec validate enhance-post-editor --type change --strict --no-interactive
git diff --check
```

Expected:

- 所有 integration tests 通過。
- TypeScript exit 0。
- ESLint 0 errors；既有 `populateAuthors.ts` unused argument warning 可記錄但不可新增 warning。
- Production build exit 0；sandbox 無法連線本機 PostgreSQL 的 `EPERM 127.0.0.1:5432` 可記錄為環境限制。
- OpenSpec valid。
- `git diff --check` 無輸出。

- [ ] **Step 3: 更新 OpenSpec 任務**

將完成項目全部改為 `- [x]`，再執行：

```bash
openspec instructions apply --change enhance-post-editor --json
```

Expected: `state: "all_done"`。
