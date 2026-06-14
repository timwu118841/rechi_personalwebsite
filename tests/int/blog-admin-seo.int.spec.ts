import { describe, expect, it } from 'vitest'

import { generateAdminSEOTitle, generateAdminSEOURL } from '@/lib/admin-seo'

describe('admin SEO preview generators', () => {
  it('uses the localized site name instead of the Payload template name', () => {
    expect(
      generateAdminSEOTitle({
        documentTitle: '離婚財產怎麼分',
        locale: 'zh-Hant',
        siteName: '林律師法律筆記',
      }),
    ).toBe('離婚財產怎麼分 | 林律師法律筆記')
  })

  it('generates the public Traditional Chinese post URL', () => {
    expect(
      generateAdminSEOURL({
        baseURL: 'https://example.com',
        collection: 'posts',
        locale: 'zh-Hant',
        slug: 'family-law',
      }),
    ).toBe('https://example.com/zh-Hant/posts/family-law')
  })

  it('generates the public English fixed-page URL', () => {
    expect(
      generateAdminSEOURL({
        baseURL: 'https://example.com',
        collection: 'pages',
        locale: 'en',
        slug: 'about',
      }),
    ).toBe('https://example.com/en/about')
  })

  it('uses the locale root for a home page document', () => {
    expect(
      generateAdminSEOURL({
        baseURL: 'https://example.com/',
        collection: 'pages',
        locale: 'en',
        slug: 'home',
      }),
    ).toBe('https://example.com/en')
  })
})
