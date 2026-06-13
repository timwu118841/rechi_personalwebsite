import type { Block } from 'payload'

export const MediaBlock: Block = {
  slug: 'mediaBlock',
  interfaceName: 'MediaBlock',
  fields: [
    {
      name: 'media',
      label: { 'zh-TW': '媒體', en: 'Media' },
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
  ],
  labels: {
    singular: { 'zh-TW': '媒體區塊', en: 'Media block' },
    plural: { 'zh-TW': '媒體區塊', en: 'Media blocks' },
  },
}
