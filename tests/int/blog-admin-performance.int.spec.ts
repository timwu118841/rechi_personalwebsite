import { describe, expect, it, vi } from 'vitest'

import { populateAuthors } from '@/collections/Posts/hooks/populateAuthors'

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
