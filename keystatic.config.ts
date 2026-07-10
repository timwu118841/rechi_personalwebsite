import { collection, config, fields } from '@keystatic/core';

const cloudProject = import.meta.env.PUBLIC_KEYSTATIC_CLOUD_PROJECT?.trim();

const storage = cloudProject ? ({ kind: 'cloud' } as const) : ({ kind: 'local' } as const);

export default config({
  storage,
  ...(cloudProject ? { cloud: { project: cloudProject } } : {}),
  locale: 'zh-TW',
  ui: {
    brand: { name: '法律實務筆記｜內容管理' },
    navigation: {
      內容編輯: ['articles'],
      內容設定: ['contentTypes', 'categories'],
    },
  },
  collections: {
    contentTypes: collection({
      label: '內容類型',
      slugField: 'name',
      path: 'src/content/content-types/*',
      format: 'yaml',
      columns: ['name', 'description'],
      schema: {
        name: fields.slug({
          name: {
            label: '類型名稱',
            description: '例如：法律文章、生活隨筆、讀書筆記。',
            validation: { isRequired: true },
          },
          slug: {
            label: '類型代稱',
            description: '建立後請盡量不要修改。建議使用英文小寫與連字號。',
          },
        }),
        description: fields.text({
          label: '類型說明',
          description: '說明這個內容類型的用途，方便之後編輯文章時辨識。',
          multiline: true,
          validation: { isRequired: true, length: { max: 180 } },
        }),
      },
    }),
    categories: collection({
      label: '文章分類',
      slugField: 'name',
      path: 'src/content/categories/*',
      format: 'yaml',
      columns: ['name', 'order', 'visible'],
      schema: {
        name: fields.slug({
          name: {
            label: '分類名稱',
            description: '顯示在網站上的名稱，例如：法律實務、職涯經驗、生活觀察。',
            validation: { isRequired: true },
          },
          slug: {
            label: '分類網址代稱',
            description: '建立後請盡量不要修改，以免既有分類網址失效。建議使用英文小寫與連字號。',
          },
        }),
        description: fields.text({
          label: '分類說明',
          description: '顯示在分類頁，說明這個分類收錄哪些文章。',
          multiline: true,
          validation: { isRequired: true, length: { max: 180 } },
        }),
        order: fields.integer({
          label: '顯示順序',
          description: '數字越小越前面。',
          defaultValue: 100,
          validation: { isRequired: true, min: 0 },
        }),
        visible: fields.checkbox({
          label: '顯示在分類頁',
          description: '關閉後會從公開分類探索頁隱藏，但不會刪除分類或文章。',
          defaultValue: true,
        }),
      },
    }),
    articles: collection({
      label: '文章內容',
      slugField: 'title',
      path: 'src/content/articles/*/',
      format: { contentField: 'content' },
      entryLayout: 'content',
      columns: ['title', 'status', 'publishedAt', 'contentType', 'category'],
      schema: {
        title: fields.slug({
          name: {
            label: '文章標題',
            description: '建議清楚表達文章解決的問題；網址發布後請勿任意變更。',
            validation: { isRequired: true },
          },
        }),
        description: fields.text({
          label: '文章摘要',
          description: '顯示於文章列表與搜尋結果，建議 70–120 字。',
          multiline: true,
          validation: { isRequired: true, length: { min: 30, max: 180 } },
        }),
        status: fields.select({
          label: '發布狀態',
          description: '只有「已發布」且日期已到的文章會出現在公開網站。',
          options: [
            { label: '草稿', value: 'draft' },
            { label: '已發布', value: 'published' },
            { label: '已下架', value: 'unpublished' },
          ],
          defaultValue: 'draft',
        }),
        publishedAt: fields.date({
          label: '發布日期',
          validation: { isRequired: true },
        }),
        updatedAt: fields.date({ label: '更新日期' }),
        contentType: fields.relationship({
          label: '內容類型',
          description: '例如：法律文章、生活隨筆。需要新類型時可先到「內容設定 → 內容類型」新增。',
          collection: 'contentTypes',
          validation: { isRequired: true },
        }),
        category: fields.relationship({
          label: '分類',
          description: '文章的主題分類；需要新分類時可先到「內容設定 → 文章分類」新增。',
          collection: 'categories',
          validation: { isRequired: true },
        }),
        tags: fields.array(fields.text({ label: '標籤' }), {
          label: '標籤',
          itemLabel: (props) => props.value || '新標籤',
        }),
        featured: fields.checkbox({ label: '首頁精選文章', defaultValue: false }),
        cover: fields.image({
          label: '封面圖片',
          description: '建議 1600×900、JPG／PNG／WebP，檔案小於 3 MB。',
          directory: 'src/assets/images/articles',
          publicPath: '@assets/images/articles/',
        }),
        coverAlt: fields.text({
          label: '封面替代文字',
          description: '有封面圖時必填，描述圖片傳達的資訊。',
        }),
        seoTitle: fields.text({
          label: 'SEO 標題（選填）',
          description: '留白時使用文章標題，建議不超過 60 個字元。',
          validation: { length: { max: 70 } },
        }),
        seoDescription: fields.text({
          label: 'SEO 描述（選填）',
          description: '留白時使用文章摘要，建議 80–160 個字元。',
          multiline: true,
          validation: { length: { max: 180 } },
        }),
        canonicalUrl: fields.url({ label: 'Canonical URL（選填）' }),
        privacyReviewed: fields.checkbox({
          label: '已確認移除不必要的姓名、聯絡方式、案號與可識別個資',
          defaultValue: false,
        }),
        legalReviewed: fields.checkbox({
          label: '已確認內容為一般資訊／經驗分享，且不構成個案法律意見',
          defaultValue: false,
        }),
        content: fields.markdoc({
          label: '文章內容',
          description: '可使用標題、粗體、清單、引用、連結與圖片編排長文。',
          extension: 'mdoc',
          options: {
            image: {
              directory: 'src/assets/images/articles',
              publicPath: '/src/assets/images/articles/',
            },
          },
        }),
      },
    }),
  },
});
