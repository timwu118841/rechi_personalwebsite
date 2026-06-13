import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { renderPostTextNode } from '@/components/RichText/postTextConverter'

describe('post rich text rendering', () => {
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
