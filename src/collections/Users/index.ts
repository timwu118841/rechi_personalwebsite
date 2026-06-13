import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: { 'zh-TW': '管理員', en: 'Administrator' },
    plural: { 'zh-TW': '管理員', en: 'Administrators' },
  },
  access: {
    admin: authenticated,
    create: authenticated,
    delete: authenticated,
    read: authenticated,
    update: authenticated,
  },
  admin: {
    defaultColumns: ['name', 'email'],
    useAsTitle: 'name',
  },
  auth: true,
  fields: [
    {
      name: 'name',
      label: { 'zh-TW': '姓名', en: 'Name' },
      type: 'text',
      required: true,
    },
    {
      name: 'bio',
      label: { 'zh-TW': '作者簡介', en: 'Biography' },
      type: 'textarea',
      localized: true,
    },
    {
      name: 'expertise',
      label: { 'zh-TW': '專業領域', en: 'Expertise' },
      type: 'text',
      localized: true,
    },
  ],
  timestamps: true,
}
