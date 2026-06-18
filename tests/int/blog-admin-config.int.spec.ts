import { describe, expect, it } from 'vitest'

import configPromise from '@/payload.config'
import { Pages } from '@/collections/Pages'
import { Posts } from '@/collections/Posts'
import { Users } from '@/collections/Users'
import { SiteSettings } from '@/globals/SiteSettings'
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

describe('homepage settings', () => {
  it('offers a localized homepage hero title field', () => {
    const field = SiteSettings.fields.find(
      (candidate) => 'name' in candidate && candidate.name === 'homepageHeroTitle',
    )

    expect(field).toMatchObject({
      label: { 'zh-TW': '首頁主標題', en: 'Homepage hero title' },
      localized: true,
      type: 'text',
    })
  })
})

describe('post editor formatting', () => {
  it('uses Payload built-in internal link fields so existing links remain editable', () => {
    const contentField = Posts.fields
      .flatMap((field) => ('tabs' in field ? field.tabs.flatMap((tab) => tab.fields) : [field]))
      .find((field) => 'name' in field && field.name === 'content')
    const editor = contentField && 'editor' in contentField ? contentField.editor : undefined
    const getLinkFields = (
      editor as {
        editorConfig?: {
          features?: {
            getSubFields?: Map<string, () => Array<Record<string, unknown>>>
          }
        }
      }
    )?.editorConfig?.features?.getSubFields?.get('link')
    const linkFields = getLinkFields?.() ?? []
    const urlField = linkFields.find((field) => field.name === 'url') as
      | { hooks?: { beforeChange?: unknown[] } }
      | undefined
    const docField = linkFields.find((field) => field.name === 'doc')

    expect(docField).toMatchObject({
      relationTo: ['pages', 'posts'],
      required: true,
      type: 'relationship',
    })
    expect(urlField?.hooks?.beforeChange).toHaveLength(1)
  })

  it('auto-generates localized post slugs while keeping manual override controls', () => {
    const slugRow = Posts.fields.find(
      (field) =>
        field.type === 'row' &&
        field.fields.some((nestedField) => 'name' in nestedField && nestedField.name === 'slug'),
    )

    expect(slugRow).toBeDefined()
    if (!slugRow || slugRow.type !== 'row') return

    const generateSlugField = slugRow.fields.find(
      (field) => 'name' in field && field.name === 'generateSlug',
    )
    const slugField = slugRow.fields.find((field) => 'name' in field && field.name === 'slug')

    expect(generateSlugField).toMatchObject({
      defaultValue: true,
      localized: true,
      type: 'checkbox',
    })
    expect(slugField).toMatchObject({
      label: { 'zh-TW': '網址代稱（Slug）', en: 'URL slug' },
      localized: true,
      required: true,
      type: 'text',
      unique: true,
    })
  })

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

describe('Unicode automatic slugs', () => {
  const getSlugify = (fields: typeof Posts.fields) => {
    const slugRow = fields.find(
      (field) =>
        field.type === 'row' &&
        field.fields.some((nestedField) => 'name' in nestedField && nestedField.name === 'slug'),
    )
    if (!slugRow || slugRow.type !== 'row') return undefined

    const slug = slugRow.fields.find(
      (field) => 'name' in field && field.name === 'slug' && field.type === 'text',
    )

    return slug && 'custom' in slug
      ? (slug.custom?.slugify as
          | ((args: { valueToSlugify?: unknown }) => string | undefined)
          | undefined)
      : undefined
  }

  it('uses the same custom slugify for posts and fixed pages', () => {
    expect(getSlugify(Posts.fields)).toBeTypeOf('function')
    expect(getSlugify(Pages.fields)).toBeTypeOf('function')
  })

  it('keeps Chinese and normalizes spaces and punctuation', () => {
    const slugify = getSlugify(Posts.fields)

    expect(slugify?.({ valueToSlugify: '離婚財產怎麼分' })).toBe('離婚財產怎麼分')
    expect(slugify?.({ valueToSlugify: '公司／股東 爭議！' })).toBe('公司-股東-爭議')
    expect(slugify?.({ valueToSlugify: '  Taiwan 公司法 2026  ' })).toBe(
      'taiwan-公司法-2026',
    )
  })

  it('returns undefined when no usable title exists', () => {
    const slugify = getSlugify(Posts.fields)

    expect(slugify?.({ valueToSlugify: undefined })).toBeUndefined()
    expect(slugify?.({ valueToSlugify: '！？ ' })).toBeUndefined()
  })
})
