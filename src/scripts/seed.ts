import configPromise from '@payload-config'
import { getPayload } from 'payload'

const categories = [
  { zh: '家事民事', en: 'Family and Civil Law', slug: 'family-civil-law' },
  { zh: '公司商務', en: 'Corporate and Business', slug: 'corporate-business' },
  { zh: '案例與經驗', en: 'Cases and Practice', slug: 'cases-and-practice' },
  { zh: '法律觀點', en: 'Legal Perspectives', slug: 'legal-perspectives' },
]

async function seed() {
  const payload = await getPayload({ config: configPromise })

  for (const category of categories) {
    const existing = await payload.find({
      collection: 'categories',
      locale: 'zh-Hant',
      fallbackLocale: false,
      limit: 1,
      where: { slug: { equals: category.slug } },
    })

    const document =
      existing.docs[0] ||
      (await payload.create({
        collection: 'categories',
        locale: 'zh-Hant',
        data: {
          title: category.zh,
          slug: category.slug,
        },
      }))

    await payload.update({
      collection: 'categories',
      id: document.id,
      locale: 'en',
      data: {
        title: category.en,
        slug: category.slug,
      },
    })
  }

  await payload.updateGlobal({
    slug: 'site-settings',
    locale: 'zh-Hant',
    data: {
      siteName: '法律筆記',
      tagline: '律師的實務筆記與法律觀察',
      authorName: '作者姓名',
      authorBio: '分享家事民事、公司商務、匿名化實務經驗與法律觀點。',
      authorExpertise: '家事民事、公司商務',
      defaultDescription: '以清楚易讀的方式分享法律知識、匿名化實務經驗與制度觀察。',
      disclaimer: '本文為一般性法律資訊與經驗分享，不構成個案法律意見或委任關係。',
    },
  })

  await payload.updateGlobal({
    slug: 'site-settings',
    locale: 'en',
    data: {
      siteName: 'Legal Notes',
      tagline: 'Practical notes and observations from a lawyer',
      authorName: 'Author Name',
      authorBio: 'Writing about family, civil, corporate and business law through anonymized practice experience.',
      authorExpertise: 'Family, civil, corporate and business law',
      defaultDescription: 'Clear, readable legal knowledge, anonymized practice experience and commentary.',
      disclaimer: 'This article provides general legal information and does not create legal advice or an attorney-client relationship.',
    },
  })

  payload.logger.info('Legal blog categories and site settings seeded.')
  process.exit(0)
}

seed().catch((error) => {
  console.error(error)
  process.exit(1)
})
