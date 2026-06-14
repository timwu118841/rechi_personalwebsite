import { slugField, type CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { authenticatedOrPublished } from '../../access/authenticatedOrPublished'
import { postEditor } from '../../fields/postEditor'
import { generatePreviewPath } from '../../utilities/generatePreviewPath'
import { populateAuthors } from './hooks/populateAuthors'
import { revalidateDelete, revalidatePost } from './hooks/revalidatePost'

import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'

export const Posts: CollectionConfig<'posts'> = {
  slug: 'posts',
  disableBulkEdit: true,
  labels: {
    singular: { 'zh-TW': '文章', en: 'Post' },
    plural: { 'zh-TW': '文章', en: 'Posts' },
  },
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticatedOrPublished,
    update: authenticated,
  },
  // This config controls what's populated by default when a post is referenced
  // https://payloadcms.com/docs/queries/select#defaultpopulate-collection-config-property
  // Type safe if the collection slug generic is passed to `CollectionConfig` - `CollectionConfig<'posts'>
  defaultPopulate: {
    title: true,
    slug: true,
    categories: true,
    meta: {
      image: true,
      description: true,
    },
  },
  admin: {
    defaultColumns: ['title', 'slug', 'updatedAt'],
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({
          slug: data?.slug,
          collection: 'posts',
          req,
        }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: data?.slug as string,
        collection: 'posts',
        req,
      }),
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      label: { 'zh-TW': '標題', en: 'Title' },
      type: 'text',
      localized: true,
      required: true,
    },
    {
      name: 'excerpt',
      label: { 'zh-TW': '文章摘要', en: 'Excerpt' },
      type: 'textarea',
      localized: true,
      required: true,
      maxLength: 240,
    },
    {
      type: 'tabs',
      tabs: [
        {
          fields: [
            {
              name: 'heroImage',
              label: { 'zh-TW': '封面圖片', en: 'Hero image' },
              type: 'upload',
              relationTo: 'media',
            },
            {
              name: 'content',
              label: { 'zh-TW': '文章內容', en: 'Content' },
              type: 'richText',
              localized: true,
              editor: postEditor,
              required: true,
            },
          ],
          label: { 'zh-TW': '文章內容', en: 'Content' },
        },
        {
          fields: [
            {
              name: 'relatedPosts',
              label: { 'zh-TW': '相關文章', en: 'Related posts' },
              type: 'relationship',
              admin: {
                position: 'sidebar',
              },
              filterOptions: ({ id }) => {
                return {
                  id: {
                    not_in: [id],
                  },
                }
              },
              hasMany: true,
              relationTo: 'posts',
            },
            {
              name: 'categories',
              label: { 'zh-TW': '分類', en: 'Categories' },
              type: 'relationship',
              admin: {
                position: 'sidebar',
              },
              hasMany: true,
              relationTo: 'categories',
            },
            {
              name: 'tags',
              label: { 'zh-TW': '標籤', en: 'Tags' },
              type: 'array',
              localized: true,
              admin: {
                position: 'sidebar',
              },
              fields: [
                {
                  name: 'label',
                  label: { 'zh-TW': '標籤名稱', en: 'Label' },
                  type: 'text',
                  required: true,
                },
              ],
            },
            {
              name: 'featured',
              label: { 'zh-TW': '設為精選文章', en: 'Featured post' },
              type: 'checkbox',
              admin: {
                position: 'sidebar',
              },
              defaultValue: false,
            },
            {
              name: 'anonymizationConfirmed',
              label: { 'zh-TW': '已確認內容匿名化', en: 'Anonymization confirmed' },
              type: 'checkbox',
              required: true,
              validate: (value) => value === true || '儲存文章前必須確認內容已匿名化。',
              admin: {
                description: '發布前請確認本文不含可識別個案資訊。',
                position: 'sidebar',
              },
            },
          ],
          label: { 'zh-TW': '文章設定', en: 'Post settings' },
        },
        {
          name: 'meta',
          label: { 'zh-TW': '搜尋引擎最佳化（SEO）', en: 'SEO' },
          localized: true,
          fields: [
            OverviewField({
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
              imagePath: 'meta.image',
            }),
            MetaTitleField({
              hasGenerateFn: true,
            }),
            MetaImageField({
              relationTo: 'media',
            }),

            MetaDescriptionField({}),
            {
              name: 'noIndex',
              type: 'checkbox',
              defaultValue: false,
              label: '禁止搜尋引擎索引',
            },
            PreviewField({
              // if the `generateUrl` function is configured
              hasGenerateFn: true,

              // field paths to match the target field for data
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
            }),
          ],
        },
      ],
    },
    {
      name: 'publishedAt',
      label: { 'zh-TW': '發布時間', en: 'Published at' },
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        position: 'sidebar',
      },
      hooks: {
        beforeChange: [
          ({ siblingData, value }) => {
            if (siblingData._status === 'published' && !value) {
              return new Date()
            }
            return value
          },
        ],
      },
    },
    slugField({
      localized: true,
      overrides: (field) => {
        const generateSlugField = field.fields.find(
          (nestedField) => 'name' in nestedField && nestedField.name === 'generateSlug',
        )
        const slug = field.fields.find(
          (nestedField) => 'name' in nestedField && nestedField.name === 'slug',
        )

        if (generateSlugField && 'name' in generateSlugField) {
          generateSlugField.label = { 'zh-TW': '依標題自動產生網址', en: 'Generate from title' }
          generateSlugField.admin = {
            ...generateSlugField.admin,
            description: {
              'zh-TW': '草稿期間會依標題更新；手動修改或發布後即固定。',
              en: 'Updates from the title while drafting, then stays fixed after manual edits or publishing.',
            },
          }
        }

        if (slug && 'name' in slug) {
          slug.label = { 'zh-TW': '網址代稱（Slug）', en: 'URL slug' }
          slug.admin = {
            ...slug.admin,
            description: {
              'zh-TW': '公開網址的一部分。發布後請避免修改，以免既有連結失效。',
              en: 'Part of the public URL. Avoid changing it after publishing.',
            },
          }
        }

        return field
      },
    }),
    {
      name: 'authors',
      label: { 'zh-TW': '作者', en: 'Authors' },
      type: 'relationship',
      admin: {
        position: 'sidebar',
      },
      hasMany: true,
      relationTo: 'users',
    },
    // This field is only used to populate the user data via the `populateAuthors` hook
    // This is because the `user` collection has access control locked to protect user privacy
    // GraphQL will also not return mutated user data that differs from the underlying schema
    {
      name: 'populatedAuthors',
      label: { 'zh-TW': '公開作者資料', en: 'Public author data' },
      type: 'array',
      access: {
        update: () => false,
      },
      admin: {
        disabled: true,
        readOnly: true,
      },
      fields: [
        {
          name: 'id',
          type: 'text',
        },
        {
          name: 'name',
          type: 'text',
        },
      ],
    },
  ],
  hooks: {
    afterChange: [revalidatePost],
    afterRead: [populateAuthors],
    afterDelete: [revalidateDelete],
  },
  versions: {
    drafts: {
      autosave: {
        interval: 100, // We set this interval for optimal live preview
      },
      schedulePublish: false,
    },
    maxPerDoc: 50,
  },
}
