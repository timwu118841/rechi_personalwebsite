import { describe, expect, it } from 'vitest'

import { alternateLocale, isLocale } from '@/lib/i18n'
import { calculateReadingMinutes } from '@/lib/reading-time'
import { isPublishedDocument } from '@/lib/publication'

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
  it('allows only published documents with localized title and slug', () => {
    expect(
      isPublishedDocument({
        _status: 'published',
        slug: 'article',
        title: '文章',
        translationReady: true,
      }),
    ).toBe(true)
    expect(
      isPublishedDocument({
        _status: 'draft',
        slug: 'article',
        title: '文章',
        translationReady: true,
      }),
    ).toBe(false)
    expect(
      isPublishedDocument({
        _status: 'published',
        slug: 'article',
        title: 'Article',
        translationReady: false,
      }),
    ).toBe(false)
    expect(
      isPublishedDocument({
        _status: 'published',
        slug: '',
        title: 'Article',
        translationReady: true,
      }),
    ).toBe(false)
  })
})
