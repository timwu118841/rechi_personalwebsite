# Design

## Source of truth

- Status: Active
- Last refreshed: 2026-07-18
- Primary product surfaces: 公開首頁、文章列表與內頁、分類、標籤、搜尋、關於、404、共用 header/footer、light/dark mode、桌機與手機版。
- Evidence reviewed: `README.md`、`src/config/site.ts`、`src/layouts/BaseLayout.astro`、`src/components/*.astro`、所有公開 `src/pages/**/*.astro`、`src/styles/global.css`、`tests/e2e/site.spec.ts`、內容 fixture、既有 SEO 與分析元件。Repo 內沒有既有 `DESIGN.md`、視覺稿、品牌手冊或視覺回歸基準。
- Design intelligence: `$ui-ux-pro-max` 的 content-first、法律專業字體、語意色彩、低動態、AA 對比、44px touch target、65–75 字元閱讀行長、375/768/1024/1440 響應式建議。

## Brand

- Personality: 冷靜、清楚、有判斷力，但不以權威姿態壓迫讀者；像一本經過編輯的實務刊物。
- Trust signals: 清楚作者身分、日期與更新資訊、內容分類、閱讀時間、免責聲明、一致的導航與可預期的內容層級。
- Avoid: 律師事務所制式金黑配色、法槌/天秤素材、過度企業化、霓虹玻璃效果、過多卡片陰影、裝飾性動畫、以英文壓過中文內容。

## Product goals

- Goals: 讓讀者快速判斷文章是否相關、長時間舒適閱讀、從分類/標籤/搜尋繼續探索，並在任何裝置與主題中維持可信度。
- Non-goals: 不改內容資料契約、發布流程、管理後台、API、資料庫、分析事件或 SEO 行為；不把網站改造成 SPA。
- Success signals: 核心路由與既有功能不變；無 JavaScript 仍可閱讀與搜尋；手機與 200% zoom 無橫向溢位；鍵盤焦點明確；light/dark 皆達 WCAG AA；內容層級在各頁一致。

## Personas and jobs

- Primary personas: 想理解法律議題的一般讀者、需要實務脈絡的工作者、透過搜尋進站並快速評估可信度的讀者。
- User jobs: 找到主題、掃描摘要、閱讀全文、理解文章背景與限制、探索相關分類或標籤、分享文章。
- Key contexts of use: 手機通勤閱讀、桌機研究、搜尋引擎深連結進入文章、低光環境 dark mode、高倍率縮放與鍵盤操作。

## Information architecture

- Primary navigation: 文章、分類、關於；搜尋與主題切換為全站工具。手機使用原生 `details/summary` 選單，無 JavaScript 仍可操作。
- Core routes/screens: `/`、`/articles/`、`/articles/[...slug]/`、`/categories/`、`/categories/[category]/`、`/tags/`、`/tags/[tag]/`、`/search/`、`/about/`、`/404`。
- Content hierarchy: 頁面識別/導覽 → 標題與導言 → 主要內容 → 分頁或延伸探索 → 法律資訊提醒與頁尾。

## Design principles

- Editorial before ornamental: 版面像編輯刊物，所有線條、色塊與編號都服務於內容定位。
- Calm hierarchy: 以字級、留白、欄寬與規律分隔建立層級，不靠大量顏色或陰影。
- Resilient content: 標題、摘要、slug、標籤可任意長並完整換行；不以截斷掩蓋內容。
- Progressive enhancement: HTML 與伺服器輸出先成立，JavaScript 只用於主題切換與既有分析。
- Tradeoffs: 保留既有 Google Fonts 載入與 Astro 元件，不新增 icon/font 套件；以 CSS 與內嵌 SVG 建立辨識度，降低依賴與 bundle 成本。

## Visual language

- Color: Light 使用暖紙色、深墨藍、灰褐文字與朱砂強調；Dark 使用深藍黑表面、暖白文字與降低飽和的珊瑚色。功能狀態全部走語意 token。
- Typography: `EB Garamond` 負責大型英文/數字與文章標題，`Lato` 搭配系統中文 sans 供介面文字；長文中文優先 serif fallback。基礎字級 16px、正文行高 1.85–1.95。
- Spacing/layout rhythm: 4/8px 基礎；主要層級使用 16/24/32/48/72/96px。全站最大寬 1184px，閱讀寬約 720px。
- Shape/radius/elevation: 小半徑 2–12px；以 1px 規則線和色面取代浮誇陰影，只在浮層選單使用單一柔和陰影。
- Motion: 150–220ms 的顏色與微位移回饋；不做進場動畫；`prefers-reduced-motion` 完全取消非必要動態。
- Imagery/iconography: 延用內容封面；無封面使用 CSS 排版圖樣。工具圖示用同一組 1.75px stroke 內嵌 SVG，不使用 emoji。

## Components

- Existing components to reuse: `BaseLayout`、`SiteHeader`、`SiteFooter`、`ArticleCard`、`TagList`、`Pagination`、`LegalDisclaimer`、`SeoHead`。
- New/changed components: 更新 header 工具列與手機選單、文章卡片的編輯式資訊層級、footer 分欄、搜尋表單、分類卡片、文章 breadcrumb/分享區；不新增資料元件。
- Variants and states: 文章卡片支援首頁精選 variant；導航 current、hover、focus、pressed；表單 focus-within；empty、404、dark mode。
- Token/component ownership: 全域 primitive/semantic/component token 由 `src/styles/global.css` 管理；元件只使用 token，不在頁面內散落色碼。

## Accessibility

- Target standard: WCAG 2.2 AA。
- Keyboard/focus behavior: 保留 skip link；所有 link/button/summary 有 3px 明確 focus ring；tab order 與視覺順序一致；手機選單使用原生 details。
- Contrast/readability: 一般文字至少 4.5:1，大型文字與 UI 邊界至少 3:1；light/dark 分別定義，不做簡單反相。
- Screen-reader semantics: 單一 h1、連續 heading hierarchy、nav/section label、表單可見 label、icon-only control 有動態 aria-label/pressed。
- Reduced motion and sensory considerations: 尊重 `prefers-reduced-motion`；資訊不只靠顏色；不使用閃爍、視差或 scroll-jacking。

## Responsive behavior

- Supported breakpoints/devices: 375px 小手機、560px、768/820px、1024px、1184/1440px；支援直向與橫向、200% zoom。
- Layout adaptations: 桌機 editorial 雙欄/三欄逐步降為單欄；閱讀頁維持窄欄；工具列在 820px 以下改原生選單；頁尾與 metadata 可換行。
- Touch/hover differences: 所有主要控制最小 44×44px；hover 只加強既有可見 affordance，不承載唯一資訊；`pointer: coarse` 不使用位移型 hover。

## Interaction states

- Loading: 公開頁面為伺服器渲染，沒有客戶端內容 loading 狀態；圖片預留尺寸避免 CLS。
- Empty: 提供清楚原因與可繼續探索的路徑。
- Error: 404 保留導航並提供首頁/文章入口；搜尋零結果提供替代入口。
- Success: 搜尋結果數以 `aria-live="polite"` 宣告。
- Disabled: 公開介面目前沒有 disabled 控制；未來需同時使用語意屬性與視覺弱化。
- Offline/slow network, if applicable: 核心內容與導航不依賴客戶端 JavaScript；字體失敗時使用系統 fallback。

## Content voice

- Tone: 精確、平實、尊重讀者，不用過度推銷語句。
- Terminology: 中文為主，短英文 kicker 僅作刊物索引，不取代中文資訊。
- Microcopy rules: 行動詞清楚（閱讀、搜尋、探索、返回）；免責資訊一致；避免只有符號的未知操作。

## Implementation constraints

- Framework/styling system: Astro + repo-local global CSS；保留 SSR/無 JS 路徑。
- Design-token constraints: 延伸既有 CSS custom properties；不引進 Tailwind、CSS-in-JS 或新 design-system layer。
- Performance constraints: 不新增依賴或第三方 script；圖像保留 width/height、lazy/eager 策略；動效只改 transform/opacity/color。
- Compatibility constraints: 保留所有路由、SEO/JSON-LD、資料讀取、快取、分析、管理端隔離與內容 markup 契約。
- Test/screenshot expectations: format、lint、Astro check、unit、build、Playwright 桌機/手機；另驗證 375px、長標題/摘要、中文 slug、200% zoom、keyboard focus、dark mode、reduced motion 與主要路由無橫向溢位。

## Open questions

- [ ] 未來若提供正式品牌資產或作者攝影，需由站主確認是否取代目前純字標與內容封面策略；目前不影響此版實作。
