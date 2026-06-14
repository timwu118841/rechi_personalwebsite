import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { searchPlugin } from '@payloadcms/plugin-search'
import { s3Storage } from '@payloadcms/storage-s3'
import { Plugin } from 'payload'
import { revalidateRedirects } from '@/hooks/revalidateRedirects'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { searchFields } from '@/search/fieldOverrides'
import { beforeSyncWithSearch } from '@/search/beforeSync'
import { generateAdminSEOTitle, generateAdminSEOURL } from '@/lib/admin-seo'
import { createR2PublicURL, resolveR2StorageConfig } from '@/lib/r2-storage'

import { Page, Post } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'

const generateTitle: GenerateTitle<Post | Page> = async ({ doc, locale, req }) => {
  let siteName: string | null | undefined

  try {
    const settings = await req.payload.findGlobal({
      slug: 'site-settings',
      locale: locale === 'en' ? 'en' : 'zh-Hant',
      fallbackLocale: false,
      depth: 0,
    })
    siteName = settings.siteName
  } catch {
    // Keep SEO generation available even if Site Settings cannot be loaded.
  }

  return generateAdminSEOTitle({
    documentTitle: doc?.title,
    locale,
    siteName,
  })
}

const generateURL: GenerateURL<Post | Page> = ({ collectionSlug, doc, locale }) =>
  generateAdminSEOURL({
    baseURL: getServerSideURL(),
    collection: collectionSlug === 'posts' ? 'posts' : 'pages',
    locale,
    slug: doc?.slug,
  })

const r2StorageConfig = resolveR2StorageConfig(process.env)

export const plugins: Plugin[] = [
  redirectsPlugin({
    collections: ['pages', 'posts'],
    overrides: {
      labels: {
        singular: { 'zh-TW': '重新導向', en: 'Redirect' },
        plural: { 'zh-TW': '重新導向', en: 'Redirects' },
      },
      // @ts-expect-error - This is a valid override, mapped fields don't resolve to the same type
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'from') {
            return {
              ...field,
              admin: {
                description: {
                  'zh-TW': '修改此欄位後，正式環境需要重新建置網站。',
                  en: 'You will need to rebuild the website when changing this field.',
                },
              },
            }
          }
          return field
        })
      },
      hooks: {
        afterChange: [revalidateRedirects],
      },
    },
  }),
  nestedDocsPlugin({
    collections: ['categories'],
    generateURL: (docs) => docs.reduce((url, doc) => `${url}/${doc.slug}`, ''),
  }),
  seoPlugin({
    generateTitle,
    generateURL,
  }),
  searchPlugin({
    collections: ['posts'],
    beforeSync: beforeSyncWithSearch,
    searchOverrides: {
      labels: {
        singular: { 'zh-TW': '搜尋索引', en: 'Search result' },
        plural: { 'zh-TW': '搜尋索引', en: 'Search results' },
      },
      fields: ({ defaultFields }) => {
        return [...defaultFields, ...searchFields]
      },
    },
  }),
  ...(r2StorageConfig
    ? [
        s3Storage({
          bucket: r2StorageConfig.bucket,
          collections: {
            media: {
              disablePayloadAccessControl: true,
              generateFileURL: ({ filename, prefix }) =>
                createR2PublicURL({
                  filename,
                  prefix,
                  publicURL: r2StorageConfig.publicURL,
                }),
            },
          },
          config: {
            credentials: {
              accessKeyId: r2StorageConfig.accessKeyId,
              secretAccessKey: r2StorageConfig.secretAccessKey,
            },
            endpoint: r2StorageConfig.endpoint,
            forcePathStyle: true,
            region: r2StorageConfig.region,
          },
        }),
      ]
    : []),
]
