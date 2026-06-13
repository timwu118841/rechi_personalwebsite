import type { MetadataRoute } from 'next'

import { siteURL } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/next/preview/', '/zh-Hant/search', '/en/search'],
    },
    sitemap: `${siteURL}/sitemap.xml`,
  }
}
