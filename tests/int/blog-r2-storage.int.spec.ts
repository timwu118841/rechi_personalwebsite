import { describe, expect, it } from 'vitest'

import {
  createR2PublicURL,
  getR2ImageRemotePattern,
  resolveR2StorageConfig,
} from '@/lib/r2-storage'

const completeEnvironment = {
  R2_ACCESS_KEY_ID: 'access-key',
  R2_BUCKET: 'legal-blog-media',
  R2_ENDPOINT: 'https://account-id.r2.cloudflarestorage.com',
  R2_PUBLIC_URL: 'https://media.tiwu.com/',
  R2_SECRET_ACCESS_KEY: 'secret-key',
}

describe('R2 media storage configuration', () => {
  it('disables R2 when no R2 environment variables are configured', () => {
    expect(resolveR2StorageConfig({})).toBeNull()
  })

  it('returns a normalized configuration when all R2 variables are configured', () => {
    expect(resolveR2StorageConfig(completeEnvironment)).toEqual({
      accessKeyId: 'access-key',
      bucket: 'legal-blog-media',
      endpoint: 'https://account-id.r2.cloudflarestorage.com',
      publicURL: 'https://media.tiwu.com',
      region: 'auto',
      secretAccessKey: 'secret-key',
    })
  })

  it('rejects a partially configured R2 environment', () => {
    expect(() =>
      resolveR2StorageConfig({
        R2_BUCKET: 'legal-blog-media',
        R2_PUBLIC_URL: 'https://media.tiwu.com',
      }),
    ).toThrow(
      'R2 設定不完整，缺少：R2_ACCESS_KEY_ID, R2_ENDPOINT, R2_SECRET_ACCESS_KEY',
    )
  })

  it('rejects a malformed public URL', () => {
    expect(() =>
      resolveR2StorageConfig({
        ...completeEnvironment,
        R2_PUBLIC_URL: 'not-a-url',
      }),
    ).toThrow('R2_PUBLIC_URL 必須是有效的 http/https URL')
  })
})

describe('R2 public media URLs', () => {
  it('joins the public URL, prefix, and filename with single slashes', () => {
    expect(
      createR2PublicURL({
        filename: 'article-cover.webp',
        prefix: 'media/posts',
        publicURL: 'https://media.tiwu.com///',
      }),
    ).toBe('https://media.tiwu.com/media/posts/article-cover.webp')
  })

  it('creates a Next.js remote image pattern from the public URL', () => {
    expect(getR2ImageRemotePattern('https://media.tiwu.com/assets/')).toEqual({
      hostname: 'media.tiwu.com',
      pathname: '/assets/**',
      port: '',
      protocol: 'https',
    })
  })

  it('does not create a remote image pattern without a public URL', () => {
    expect(getR2ImageRemotePattern()).toBeNull()
  })
})
