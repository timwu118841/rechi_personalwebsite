import { beforeEach, describe, expect, it, vi } from 'vitest'

const { revalidatePath, revalidateTag } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath,
  revalidateTag,
}))

import { revalidateDelete, revalidatePost } from '@/collections/Posts/hooks/revalidatePost'

describe('post revalidation', () => {
  beforeEach(() => {
    revalidatePath.mockReset()
    revalidateTag.mockReset()
  })

  it('revalidates home and category list paths when a post is deleted', () => {
    revalidateDelete({
      doc: {
        _status: 'published',
        slug: 'deleted-post',
        categories: [{ id: 1, slug: '家事民事' }],
      },
      req: { context: {} },
    } as never)

    expect(revalidatePath).toHaveBeenCalledWith('/zh-Hant/posts/deleted-post')
    expect(revalidatePath).toHaveBeenCalledWith('/en/posts/deleted-post')
    expect(revalidatePath).toHaveBeenCalledWith('/zh-Hant')
    expect(revalidatePath).toHaveBeenCalledWith('/en')
    expect(revalidatePath).toHaveBeenCalledWith(
      '/zh-Hant/categories/%E5%AE%B6%E4%BA%8B%E6%B0%91%E4%BA%8B',
    )
    expect(revalidatePath).toHaveBeenCalledWith(
      '/en/categories/%E5%AE%B6%E4%BA%8B%E6%B0%91%E4%BA%8B',
    )
    expect(revalidateTag).toHaveBeenCalledWith('posts', 'max')
  })

  it('revalidates list paths when a published post changes', () => {
    revalidatePost({
      doc: {
        _status: 'published',
        slug: 'updated-post',
        categories: [{ id: 2, slug: '公司商務' }],
      },
      previousDoc: {
        _status: 'published',
        slug: 'old-post',
        categories: [{ id: 3, slug: '舊分類' }],
      },
      req: { context: {}, payload: { logger: { info: vi.fn() } } },
    } as never)

    expect(revalidatePath).toHaveBeenCalledWith('/zh-Hant')
    expect(revalidatePath).toHaveBeenCalledWith('/en')
    expect(revalidatePath).toHaveBeenCalledWith(
      '/zh-Hant/categories/%E5%85%AC%E5%8F%B8%E5%95%86%E5%8B%99',
    )
    expect(revalidatePath).toHaveBeenCalledWith(
      '/en/categories/%E5%85%AC%E5%8F%B8%E5%95%86%E5%8B%99',
    )
    expect(revalidatePath).toHaveBeenCalledWith('/zh-Hant/categories/%E8%88%8A%E5%88%86%E9%A1%9E')
    expect(revalidatePath).toHaveBeenCalledWith('/en/categories/%E8%88%8A%E5%88%86%E9%A1%9E')
  })

  it('revalidates the old detail path when a published post slug changes', () => {
    revalidatePost({
      doc: {
        _status: 'published',
        slug: 'new-post-slug',
        categories: [],
      },
      previousDoc: {
        _status: 'published',
        slug: 'old-post-slug',
        categories: [],
      },
      req: { context: {}, payload: { logger: { info: vi.fn() } } },
    } as never)

    expect(revalidatePath).toHaveBeenCalledWith('/zh-Hant/posts/new-post-slug')
    expect(revalidatePath).toHaveBeenCalledWith('/en/posts/new-post-slug')
    expect(revalidatePath).toHaveBeenCalledWith('/zh-Hant/posts/old-post-slug')
    expect(revalidatePath).toHaveBeenCalledWith('/en/posts/old-post-slug')
  })

  it('deduplicates repeated post list revalidation paths during published updates', () => {
    revalidatePost({
      doc: {
        _status: 'published',
        slug: 'same-category-post',
        categories: [{ id: 2, slug: '公司商務' }],
      },
      previousDoc: {
        _status: 'published',
        slug: 'same-category-post',
        categories: [{ id: 2, slug: '公司商務' }],
      },
      req: { context: {}, payload: { logger: { info: vi.fn() } } },
    } as never)

    const paths = revalidatePath.mock.calls.map(([path]) => path)

    expect(paths).toHaveLength(new Set(paths).size)
  })

  it('does not throw when Payload omits previousDoc during a slug update', () => {
    expect(() =>
      revalidatePost({
        doc: {
          _status: 'published',
          slug: 'new-slug',
          categories: [],
        },
        previousDoc: undefined,
        req: { context: {}, payload: { logger: { info: vi.fn() } } },
      } as never),
    ).not.toThrow()

    expect(revalidatePath).toHaveBeenCalledWith('/zh-Hant/posts/new-slug')
    expect(revalidatePath).toHaveBeenCalledWith('/en/posts/new-slug')
  })

  it('skips invalid old and new slug values during post revalidation', () => {
    expect(() =>
      revalidatePost({
        doc: {
          _status: 'published',
          slug: undefined,
          categories: [],
        },
        previousDoc: {
          _status: 'published',
          slug: '',
          categories: [],
        },
        req: { context: {}, payload: { logger: { info: vi.fn() } } },
      } as never),
    ).not.toThrow()

    expect(revalidatePath).not.toHaveBeenCalledWith('/zh-Hant/posts/undefined')
    expect(revalidatePath).not.toHaveBeenCalledWith('/zh-Hant/posts/')
  })
})
