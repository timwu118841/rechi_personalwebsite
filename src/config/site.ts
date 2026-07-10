export const siteConfig = {
  name: import.meta.env.PUBLIC_SITE_NAME || '法律實務筆記',
  shortName: '法律筆記',
  description: '從實務現場出發，記錄法律工作、制度觀察與日常生活中的法律思考。',
  author: {
    name: 'Rechi',
    role: '法律實務工作者',
    bio: '持續整理法律實務經驗，讓複雜的法律問題更容易被理解。',
  },
  social: {
    email: 'hello@example.com',
    linkedin: '',
  },
  nav: [
    { label: '文章', href: '/articles/' },
    { label: '分類', href: '/categories/' },
    { label: '關於', href: '/about/' },
  ],
  disclaimer:
    '本站內容僅為一般法律資訊與個人經驗分享，不構成針對任何個案的法律意見、委任關係或結果保證。實際案件請諮詢合格專業人士。',
  googleSiteVerification: import.meta.env.PUBLIC_GOOGLE_SITE_VERIFICATION || '',
} as const;

export type SiteConfig = typeof siteConfig;
