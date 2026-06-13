import type { GlobalConfig } from 'payload'

import { anyone } from '@/access/anyone'
import { authenticated } from '@/access/authenticated'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  access: {
    read: anyone,
    update: authenticated,
  },
  fields: [
    {
      name: 'siteName',
      type: 'text',
      localized: true,
      required: true,
      defaultValue: '法律筆記',
    },
    {
      name: 'tagline',
      type: 'text',
      localized: true,
      required: true,
      defaultValue: '律師的實務筆記與法律觀察',
    },
    {
      name: 'authorName',
      type: 'text',
      required: true,
      defaultValue: '作者姓名',
    },
    {
      name: 'authorBio',
      type: 'textarea',
      localized: true,
      required: true,
      defaultValue: '分享家事民事、公司商務與法律實務經驗。',
    },
    {
      name: 'authorExpertise',
      type: 'text',
      localized: true,
      defaultValue: '家事民事、公司商務',
    },
    {
      name: 'authorPhoto',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'defaultDescription',
      type: 'textarea',
      localized: true,
      required: true,
      defaultValue: '以清楚易讀的方式分享法律知識、匿名化實務經驗與制度觀察。',
    },
    {
      name: 'disclaimer',
      type: 'textarea',
      localized: true,
      required: true,
      defaultValue: '本文為一般性法律資訊與經驗分享，不構成個案法律意見或委任關係。',
    },
  ],
}
