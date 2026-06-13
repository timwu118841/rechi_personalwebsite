import {
  AlignFeature,
  BlockquoteFeature,
  BlocksFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  IndentFeature,
  InlineToolbarFeature,
  OrderedListFeature,
  StrikethroughFeature,
  SubscriptFeature,
  SuperscriptFeature,
  TextStateFeature,
  UnderlineFeature,
  UnorderedListFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

import { Banner } from '@/blocks/Banner/config'
import { Code } from '@/blocks/Code/config'
import { MediaBlock } from '@/blocks/MediaBlock/config'
import { postFontSizeStyles, postTextColorStyles } from './postTextStyles'

export { postFontSizeStyles, postTextColorStyles } from './postTextStyles'

export const postEditorFeatures = [
  HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
  AlignFeature(),
  BlockquoteFeature(),
  IndentFeature(),
  UnorderedListFeature(),
  OrderedListFeature(),
  UnderlineFeature(),
  StrikethroughFeature(),
  SubscriptFeature(),
  SuperscriptFeature(),
  TextStateFeature({
    state: {
      color: postTextColorStyles,
      fontSize: postFontSizeStyles,
    },
  }),
  BlocksFeature({ blocks: [Banner, Code, MediaBlock] }),
  HorizontalRuleFeature(),
  FixedToolbarFeature(),
  InlineToolbarFeature(),
]

const overriddenFeatureKeys = new Set(postEditorFeatures.map((feature) => feature.key))

export const postEditor = lexicalEditor({
  features: ({ rootFeatures }) => [
    ...rootFeatures.filter((feature) => !overriddenFeatureKeys.has(feature.key)),
    ...postEditorFeatures,
  ],
})
