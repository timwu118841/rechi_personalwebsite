import { describe, expect, it, vi } from 'vitest'

import { Pages } from '@/collections/Pages'
import { Posts } from '@/collections/Posts'
import { populateAuthors } from '@/collections/Posts/hooks/populateAuthors'
import configPromise from '@/payload.config'

describe('admin post read performance', () => {
  it('skips manual author lookup for authenticated admin reads', async () => {
    const findByID = vi.fn()
    const doc = { authors: [1], populatedAuthors: [] }

    const result = await populateAuthors({
      doc,
      req: {
        context: {},
        payload: { findByID },
        user: { id: 1 },
      },
    } as never)

    expect(result).toBe(doc)
    expect(findByID).not.toHaveBeenCalled()
  })

  it('skips manual author lookup when list queries opt out', async () => {
    const findByID = vi.fn()
    const doc = { authors: [1], populatedAuthors: [] }

    await populateAuthors({
      doc,
      req: {
        context: { skipPopulateAuthors: true },
        payload: { findByID },
        user: null,
      },
    } as never)

    expect(findByID).not.toHaveBeenCalled()
  })

  it('still populates public post detail author names when needed', async () => {
    const findByID = vi.fn().mockResolvedValue({ id: 1, name: '王律師' })
    const doc = { authors: [1], populatedAuthors: [] }

    const result = await populateAuthors({
      doc,
      req: {
        context: {},
        payload: { findByID },
        user: null,
      },
    } as never)

    expect(findByID).toHaveBeenCalledTimes(1)
    expect(result.populatedAuthors).toEqual([{ id: 1, name: '王律師' }])
  })
})

describe('admin performance configuration', () => {
  it('does not register an unused search index collection for article writes', async () => {
    const config = await configPromise

    expect(config.collections.map((collection) => collection.slug)).not.toContain('search')
  })

  it('keeps fewer draft versions for a single-author blog admin', () => {
    expect(typeof Posts.versions === 'object' ? Posts.versions.maxPerDoc : undefined).toBe(10)
    expect(typeof Pages.versions === 'object' ? Pages.versions.maxPerDoc : undefined).toBe(10)
  })

  it('does not enable live preview for posts or pages when the admin only needs normal editing', () => {
    expect(Posts.admin?.livePreview).toBeUndefined()
    expect(Pages.admin?.livePreview).toBeUndefined()
  })

  it('keeps post reference population lean for admin lists and relationship fields', () => {
    expect(Posts.defaultPopulate).toEqual({
      title: true,
      slug: true,
    })
  })
})
