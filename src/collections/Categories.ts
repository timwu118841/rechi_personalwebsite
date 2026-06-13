import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'

export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: {
    singular: { 'zh-TW': '文章分類', en: 'Category' },
    plural: { 'zh-TW': '文章分類', en: 'Categories' },
  },
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  admin: {
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      label: { 'zh-TW': '分類名稱', en: 'Title' },
      type: 'text',
      localized: true,
      required: true,
    },
    {
      name: 'slug',
      label: { 'zh-TW': '網址代稱（Slug）', en: 'URL slug' },
      type: 'text',
      localized: true,
      required: true,
      unique: true,
      index: true,
    },
  ],
}
