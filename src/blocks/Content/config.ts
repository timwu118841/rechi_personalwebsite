import type { Block, Field } from 'payload'

import {
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

import { link } from '@/fields/link'

const columnFields: Field[] = [
  {
    name: 'size',
    label: { 'zh-TW': '欄寬', en: 'Column width' },
    type: 'select',
    defaultValue: 'oneThird',
    options: [
      {
        label: { 'zh-TW': '三分之一', en: 'One third' },
        value: 'oneThird',
      },
      {
        label: { 'zh-TW': '二分之一', en: 'Half' },
        value: 'half',
      },
      {
        label: { 'zh-TW': '三分之二', en: 'Two thirds' },
        value: 'twoThirds',
      },
      {
        label: { 'zh-TW': '滿版', en: 'Full' },
        value: 'full',
      },
    ],
  },
  {
    name: 'richText',
    type: 'richText',
    editor: lexicalEditor({
      features: ({ rootFeatures }) => {
        return [
          ...rootFeatures,
          HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
          FixedToolbarFeature(),
          InlineToolbarFeature(),
        ]
      },
    }),
    label: false,
  },
  {
    name: 'enableLink',
    label: { 'zh-TW': '加入連結', en: 'Enable link' },
    type: 'checkbox',
  },
  link({
    overrides: {
      admin: {
        condition: (_data, siblingData) => {
          return Boolean(siblingData?.enableLink)
        },
      },
    },
  }),
]

export const Content: Block = {
  slug: 'content',
  interfaceName: 'ContentBlock',
  fields: [
    {
      name: 'columns',
      label: { 'zh-TW': '內容欄位', en: 'Columns' },
      type: 'array',
      admin: {
        initCollapsed: true,
      },
      fields: columnFields,
    },
  ],
  labels: {
    singular: { 'zh-TW': '文字內容', en: 'Content' },
    plural: { 'zh-TW': '文字內容', en: 'Content blocks' },
  },
}
