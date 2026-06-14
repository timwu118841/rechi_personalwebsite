import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import RichText from '@/components/RichText'
import { renderPostTextNode } from '@/components/RichText/postTextConverter'
import type { DefaultTypedEditorState } from '@payloadcms/richtext-lexical'

vi.mock('@/blocks/Banner/Component', () => ({
  BannerBlock: () => null,
}))
vi.mock('@/blocks/CallToAction/Component', () => ({
  CallToActionBlock: () => null,
}))
vi.mock('@/blocks/Code/Component', () => ({
  CodeBlock: () => null,
}))
vi.mock('@/blocks/MediaBlock/Component', () => ({
  MediaBlock: () => null,
}))

const internalLinkState = ({
  relationTo,
  slug,
}: {
  relationTo: 'pages' | 'posts'
  slug: string
}): DefaultTypedEditorState =>
  ({
    root: {
      children: [
        {
          children: [
            {
              children: [
                {
                  detail: 0,
                  format: 0,
                  mode: 'normal',
                  style: '',
                  text: '站內連結',
                  type: 'text',
                  version: 1,
                },
              ],
              direction: null,
              fields: {
                doc: {
                  relationTo,
                  value: {
                    id: 1,
                    slug,
                  },
                },
                linkType: 'internal',
                newTab: false,
              },
              format: '',
              indent: 0,
              type: 'link',
              version: 3,
            },
          ],
          direction: null,
          format: '',
          indent: 0,
          textFormat: 0,
          textStyle: '',
          type: 'paragraph',
          version: 1,
        },
      ],
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }) as unknown as DefaultTypedEditorState

describe('post rich text rendering', () => {
  it('includes the current locale and posts path in internal article links', () => {
    const markup = renderToStaticMarkup(
      createElement(RichText, {
        data: internalLinkState({ relationTo: 'posts', slug: 'company-law' }),
        locale: 'en',
      }),
    )

    expect(markup).toContain('href="/en/posts/company-law"')
  })

  it('encodes localized slugs and keeps the current locale in internal links', () => {
    const markup = renderToStaticMarkup(
      createElement(RichText, {
        data: internalLinkState({ relationTo: 'posts', slug: '家事法律' }),
        locale: 'zh-Hant',
      }),
    )

    expect(markup).toContain(
      'href="/zh-Hant/posts/%E5%AE%B6%E4%BA%8B%E6%B3%95%E5%BE%8B"',
    )
  })

  it('includes the current locale in internal fixed-page links', () => {
    const markup = renderToStaticMarkup(
      createElement(RichText, {
        data: internalLinkState({ relationTo: 'pages', slug: 'about' }),
        locale: 'en',
      }),
    )

    expect(markup).toContain('href="/en/about"')
  })

  it('renders approved text colors and font sizes with stable data attributes', () => {
    const markup = renderToStaticMarkup(
      renderPostTextNode({
        type: 'text',
        text: '重要文字',
        format: 1,
        mode: 'normal',
        style: '',
        detail: 0,
        version: 1,
        $: {
          color: 'wine',
          fontSize: '24px',
        },
      }),
    )

    expect(markup).toContain('<strong>重要文字</strong>')
    expect(markup).toContain('color:#7F1D1D')
    expect(markup).toContain('font-size:24px')
    expect(markup).toContain('data-text-color="wine"')
    expect(markup).toContain('data-font-size="24px"')
  })

  it('ignores unknown text states instead of rendering arbitrary styles', () => {
    const markup = renderToStaticMarkup(
      renderPostTextNode({
        type: 'text',
        text: '安全文字',
        format: 0,
        mode: 'normal',
        style: '',
        detail: 0,
        version: 1,
        $: {
          color: 'url(javascript:alert(1))',
          fontSize: '999px',
        },
      }),
    )

    expect(markup).toBe('安全文字')
  })
})
