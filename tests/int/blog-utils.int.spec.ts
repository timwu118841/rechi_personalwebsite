import { describe, expect, it } from 'vitest'

import { alternateLocale, isLocale } from '@/lib/i18n'
import { calculateReadingMinutes } from '@/lib/reading-time'
import { isPublishedDocument } from '@/lib/publication'
import { resolvePostAuthorName } from '@/lib/post-author'
import { resolveCMSLinkHref } from '@/lib/navigation'

describe('locale helpers', () => {
  it('accepts supported locales only', () => {
    expect(isLocale('zh-Hant')).toBe(true)
    expect(isLocale('en')).toBe(true)
    expect(isLocale('zh-TW')).toBe(false)
  })

  it('switches between Chinese and English', () => {
    expect(alternateLocale('zh-Hant')).toBe('en')
    expect(alternateLocale('en')).toBe('zh-Hant')
  })
})

describe('reading time', () => {
  it('calculates Chinese reading time by character count', () => {
    const content = { root: { children: [{ text: '法'.repeat(801) }] } }
    expect(calculateReadingMinutes(content, 'zh-Hant')).toBe(3)
  })

  it('calculates English reading time by word count', () => {
    const content = { root: { children: [{ text: Array(221).fill('law').join(' ') }] } }
    expect(calculateReadingMinutes(content, 'en')).toBe(2)
  })

  it('returns one minute for empty content', () => {
    expect(calculateReadingMinutes(null, 'en')).toBe(1)
  })
})

describe('public content filtering', () => {
  it('allows published documents with localized title and slug without another publish toggle', () => {
    expect(
      isPublishedDocument({
        _status: 'published',
        slug: 'article',
        title: '文章',
      }),
    ).toBe(true)
    expect(
      isPublishedDocument({
        _status: 'draft',
        slug: 'article',
        title: '文章',
      }),
    ).toBe(false)
    expect(
      isPublishedDocument({
        _status: 'published',
        slug: 'article',
        title: 'Article',
      }),
    ).toBe(true)
    expect(
      isPublishedDocument({
        _status: 'published',
        slug: '',
        title: 'Article',
      }),
    ).toBe(false)
  })
})

describe('post author', () => {
  it('uses the authors assigned to the post before the site default', () => {
    expect(
      resolvePostAuthorName(
        {
          populatedAuthors: [{ name: '王大明律師' }, { name: '林小華律師' }],
        },
        '預設作者',
      ),
    ).toBe('王大明律師、林小華律師')
  })

  it('falls back to the site author when the post has no assigned author', () => {
    expect(resolvePostAuthorName({ populatedAuthors: [] }, '預設作者')).toBe('預設作者')
  })
})

describe('localized navigation', () => {
  it('adds the current locale to internal page and post links', () => {
    expect(
      resolveCMSLinkHref(
        {
          type: 'reference',
          reference: { relationTo: 'pages', value: { slug: 'privacy' } },
        },
        'zh-Hant',
      ),
    ).toBe('/zh-Hant/privacy')
    expect(
      resolveCMSLinkHref(
        {
          type: 'reference',
          reference: { relationTo: 'posts', value: { slug: 'company-law' } },
        },
        'en',
      ),
    ).toBe('/en/posts/company-law')
  })

  it('keeps custom external URLs unchanged', () => {
    expect(
      resolveCMSLinkHref({ type: 'custom', url: 'https://example.com' }, 'zh-Hant'),
    ).toBe('https://example.com')
  })
})
