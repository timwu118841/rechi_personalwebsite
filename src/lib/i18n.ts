export const locales = ['zh-Hant', 'en'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'zh-Hant'

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale)
}

export const copy = {
  'zh-Hant': {
    siteName: '法律筆記',
    nav: {
      home: '文章',
      about: '關於作者',
      search: '搜尋',
    },
    heroEyebrow: '律師的實務筆記與法律觀察',
    heroTitle: '把複雜的法律，寫成值得閱讀的經驗。',
    latest: '最新文章',
    featured: '精選文章',
    readMore: '繼續閱讀',
    minutes: '分鐘閱讀',
    updated: '更新於',
    categories: '文章分類',
    noPosts: '目前尚無已發布文章。',
    searchTitle: '搜尋文章',
    searchPlaceholder: '輸入法律主題或關鍵字',
    noResults: '找不到符合條件的文章。',
    about: '關於作者',
    disclaimerTitle: '閱讀提醒',
  },
  en: {
    siteName: 'Legal Notes',
    nav: {
      home: 'Stories',
      about: 'About',
      search: 'Search',
    },
    heroEyebrow: 'Practical notes and observations from a lawyer',
    heroTitle: 'Making complex law worth reading.',
    latest: 'Latest stories',
    featured: 'Featured story',
    readMore: 'Continue reading',
    minutes: 'min read',
    updated: 'Updated',
    categories: 'Topics',
    noPosts: 'No published stories yet.',
    searchTitle: 'Search stories',
    searchPlaceholder: 'Search a legal topic',
    noResults: 'No matching stories were found.',
    about: 'About the author',
    disclaimerTitle: 'Reading notice',
  },
} as const

export function alternateLocale(locale: Locale): Locale {
  return locale === 'zh-Hant' ? 'en' : 'zh-Hant'
}
