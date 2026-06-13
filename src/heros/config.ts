import type { Field } from 'payload'

import {
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

import { linkGroup } from '@/fields/linkGroup'

export const hero: Field = {
  name: 'hero',
  type: 'group',
  fields: [
    {
      name: 'type',
      type: 'select',
      defaultValue: 'lowImpact',
      label: { 'zh-TW': '頁首樣式', en: 'Type' },
      options: [
        {
          label: { 'zh-TW': '不顯示', en: 'None' },
          value: 'none',
        },
        {
          label: { 'zh-TW': '大型頁首', en: 'High impact' },
          value: 'highImpact',
        },
        {
          label: { 'zh-TW': '中型頁首', en: 'Medium impact' },
          value: 'mediumImpact',
        },
        {
          label: { 'zh-TW': '簡潔頁首', en: 'Low impact' },
          value: 'lowImpact',
        },
      ],
      required: true,
    },
    {
      name: 'richText',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [
            ...rootFeatures,
            HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
            FixedToolbarFeature(),
            InlineToolbarFeature(),
          ]
        },
      }),
      label: false,
    },
    linkGroup({
      overrides: {
        maxRows: 2,
      },
    }),
    {
      name: 'media',
      label: { 'zh-TW': '頁首圖片', en: 'Media' },
      type: 'upload',
      admin: {
        condition: (_, { type } = {}) => ['highImpact', 'mediumImpact'].includes(type),
      },
      relationTo: 'media',
      required: true,
    },
  ],
  label: false,
}
