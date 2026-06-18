import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getPayload, payloadFind, unstableCache } = vi.hoisted(() => ({
  getPayload: vi.fn(),
  payloadFind: vi.fn(),
  unstableCache: vi.fn(
    <Callback extends (...args: never[]) => unknown>(
      callback: Callback,
      keyParts?: string[],
    ): Callback => {
      const cache = new Map<string, unknown>()
      return ((...args: never[]) => {
        const key = JSON.stringify([keyParts, args])
        if (!cache.has(key)) cache.set(key, callback(...args))
        return cache.get(key)
      }) as Callback
    },
  ),
}))

vi.mock('payload', () => ({
  getPayload,
}))

vi.mock('next/cache', () => ({
  unstable_cache: unstableCache,
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

import { getPostBySlug } from '@/lib/content'

describe('blog content query performance', () => {
  beforeEach(() => {
    payloadFind.mockReset()
    getPayload.mockResolvedValue({ find: payloadFind })
  })

  it('loads a post detail directly by slug without first querying the latest post list', async () => {
    payloadFind.mockResolvedValueOnce({
      docs: [
        {
          id: 1,
          slug: 'target-post',
          title: '目標文章',
        },
      ],
    })

    const post = await getPostBySlug('zh-Hant', 'target-post')

    expect(post?.slug).toBe('target-post')
    expect(payloadFind).toHaveBeenCalledTimes(1)
    expect(payloadFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'posts',
        limit: 1,
        locale: 'zh-Hant',
        where: expect.objectContaining({
          and: expect.arrayContaining([{ slug: { equals: 'target-post' } }]),
        }),
      }),
    )
  })

  it('decodes URL-encoded Chinese slug before querying Payload', async () => {
    payloadFind.mockResolvedValueOnce({
      docs: [
        {
          id: 2,
          slug: '離婚財產怎麼分',
          title: '離婚財產怎麼分',
        },
      ],
    })

    const post = await getPostBySlug('zh-Hant', '%E9%9B%A2%E5%A9%9A%E8%B2%A1%E7%94%A2%E6%80%8E%E9%BA%BC%E5%88%86')

    expect(post?.slug).toBe('離婚財產怎麼分')
    expect(payloadFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          and: expect.arrayContaining([{ slug: { equals: '離婚財產怎麼分' } }]),
        }),
      }),
    )
  })

  it('caches repeated post detail lookups by locale and slug', async () => {
    payloadFind.mockResolvedValueOnce({
      docs: [
        {
          id: 3,
          slug: 'cached-post',
          title: '快取文章',
        },
      ],
    })

    await getPostBySlug('zh-Hant', 'cached-post')
    await getPostBySlug('zh-Hant', 'cached-post')

    expect(payloadFind).toHaveBeenCalledTimes(1)
  })
})
