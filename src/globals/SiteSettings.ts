import type { GlobalConfig } from 'payload'

import { anyone } from '@/access/anyone'
import { authenticated } from '@/access/authenticated'
import { revalidateSiteSettings } from './revalidateSiteSettings'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: { 'zh-TW': '網站設定', en: 'Site settings' },
  access: {
    read: anyone,
    update: authenticated,
  },
  fields: [
    {
      name: 'siteName',
      label: { 'zh-TW': '網站名稱', en: 'Site name' },
      type: 'text',
      localized: true,
      required: true,
      defaultValue: '法律筆記',
    },
    {
      name: 'tagline',
      label: { 'zh-TW': '網站標語', en: 'Tagline' },
      type: 'text',
      localized: true,
      required: true,
      defaultValue: '律師的實務筆記與法律觀察',
    },
    {
      name: 'homepageHeroTitle',
      label: { 'zh-TW': '首頁主標題', en: 'Homepage hero title' },
      type: 'text',
      localized: true,
    },
    {
      name: 'authorName',
      label: { 'zh-TW': '預設作者姓名', en: 'Default author name' },
      type: 'text',
      required: true,
      defaultValue: '作者姓名',
    },
    {
      name: 'authorBio',
      label: { 'zh-TW': '預設作者簡介', en: 'Default author biography' },
      type: 'textarea',
      localized: true,
      required: true,
      defaultValue: '分享家事民事、公司商務與法律實務經驗。',
    },
    {
      name: 'authorExpertise',
      label: { 'zh-TW': '預設專業領域', en: 'Default expertise' },
      type: 'text',
      localized: true,
      defaultValue: '家事民事、公司商務',
    },
    {
      name: 'authorPhoto',
      label: { 'zh-TW': '作者照片', en: 'Author photo' },
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'defaultDescription',
      label: { 'zh-TW': '預設 SEO 描述', en: 'Default SEO description' },
      type: 'textarea',
      localized: true,
      required: true,
      defaultValue: '以清楚易讀的方式分享法律知識、匿名化實務經驗與制度觀察。',
    },
    {
      name: 'disclaimer',
      label: { 'zh-TW': '法律免責聲明', en: 'Legal disclaimer' },
      type: 'textarea',
      localized: true,
      required: true,
      defaultValue: '本文為一般性法律資訊與經驗分享，不構成個案法律意見或委任關係。',
    },
  ],
  hooks: {
    afterChange: [revalidateSiteSettings],
  },
}
