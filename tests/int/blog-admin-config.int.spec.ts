import { describe, expect, it } from 'vitest'

import configPromise from '@/payload.config'
import { Pages } from '@/collections/Pages'
import { Posts } from '@/collections/Posts'
import { Users } from '@/collections/Users'
import {
  postEditorFeatures,
  postFontSizeStyles,
  postTextColorStyles,
} from '@/fields/postEditor'

describe('admin localization', () => {
  it('supports Traditional Chinese and English admin interfaces', async () => {
    const config = await configPromise

    expect(Object.keys(config.i18n.supportedLanguages)).toEqual(
      expect.arrayContaining(['zh-TW', 'en']),
    )
    expect(Posts.labels).toEqual({
      singular: { 'zh-TW': '文章', en: 'Post' },
      plural: { 'zh-TW': '文章', en: 'Posts' },
    })
    const zhTwTranslations = config.i18n.translations['zh-TW'] as Record<string, unknown>
    expect(zhTwTranslations['plugin-redirects']).toEqual({
      customUrl: '自訂網址',
      documentToRedirect: '重新導向至',
      fromUrl: '來源網址',
      internalLink: '站內連結',
      redirectType: '重新導向類型',
      toUrlType: '目標網址類型',
    })
  })

  it('disables misleading bulk publishing for editorial content', () => {
    expect(Pages.disableBulkEdit).toBe(true)
    expect(Posts.disableBulkEdit).toBe(true)
  })
})

describe('admin registration access', () => {
  it('does not let unauthenticated visitors create admin users', async () => {
    const createAccess = Users.access?.create
    expect(typeof createAccess).toBe('function')

    const denied = await createAccess!({ req: { user: null } } as never)
    const allowed = await createAccess!({ req: { user: { id: 1 } } } as never)

    expect(denied).toBe(false)
    expect(allowed).toBe(true)
  })
})

describe('blog-focused administration', () => {
  it('does not register visitor forms or form submissions', async () => {
    const config = await configPromise
    const collectionSlugs = config.collections.map((collection) => collection.slug)

    expect(collectionSlugs).not.toContain('forms')
    expect(collectionSlugs).not.toContain('form-submissions')
  })

  it('does not offer a form block in fixed pages', () => {
    const serializedFields = JSON.stringify(Pages.fields)

    expect(serializedFields).not.toContain('"slug":"formBlock"')
  })
})

describe('post editor formatting', () => {
  it('offers the approved fixed text colors and detailed font sizes', () => {
    expect(Object.keys(postTextColorStyles)).toHaveLength(16)
    expect(Object.keys(postFontSizeStyles)).toEqual([
      '12px',
      '14px',
      '16px',
      '18px',
      '20px',
      '24px',
      '28px',
      '32px',
      '36px',
      '40px',
    ])
  })

  it('registers the extended legal article formatting tools', () => {
    expect(postEditorFeatures.map((feature) => feature.key)).toEqual(
      expect.arrayContaining([
        'align',
        'blockquote',
        'indent',
        'orderedList',
        'strikethrough',
        'subscript',
        'superscript',
        'textState',
        'underline',
        'unorderedList',
      ]),
    )
  })

  it('uses the centralized editor for article content', () => {
    const contentField = Posts.fields
      .flatMap((field) => ('tabs' in field ? field.tabs.flatMap((tab) => tab.fields) : [field]))
      .find((field) => 'name' in field && field.name === 'content')
    const editor = contentField && 'editor' in contentField ? contentField.editor : undefined
    const sanitizedEditor = editor as
      | {
          editorConfig?: {
            features?: {
              enabledFeatures?: string[]
            }
          }
        }
      | undefined
    const editorFeatures = sanitizedEditor?.editorConfig?.features?.enabledFeatures ?? []

    expect(editorFeatures).toEqual(
      expect.arrayContaining(['align', 'textState', 'underline', 'unorderedList']),
    )
  })
})
