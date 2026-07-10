import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const categories = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/categories' }),
  schema: z.object({
    name: z.string().min(1),
    description: z.string().min(1).max(180),
    order: z.number().int().min(0).default(100),
    visible: z.boolean().default(true),
  }),
});

const contentTypes = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/content-types' }),
  schema: z.object({
    name: z.string().min(1),
    description: z.string().min(1).max(180),
  }),
});

const articles = defineCollection({
  loader: glob({ pattern: '**/index.mdoc', base: './src/content/articles' }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().min(1),
        description: z.string().min(30).max(180),
        status: z.enum(['draft', 'published', 'unpublished']),
        publishedAt: z.coerce.date(),
        updatedAt: z.coerce.date().optional(),
        contentType: z.string().min(1),
        category: z.string().min(1),
        tags: z.array(z.string()).default([]),
        featured: z.boolean().default(false),
        cover: image().optional(),
        coverAlt: z.string().optional(),
        seoTitle: z.string().max(70).optional(),
        seoDescription: z.string().max(180).optional(),
        canonicalUrl: z.url().optional(),
        privacyReviewed: z.boolean().default(false),
        legalReviewed: z.boolean().default(false),
      })
      .superRefine((article, context) => {
        if (article.cover && !article.coverAlt?.trim()) {
          context.addIssue({
            code: 'custom',
            path: ['coverAlt'],
            message: '設定封面圖片時必須提供替代文字。',
          });
        }
        if (
          article.status === 'published' &&
          (!article.privacyReviewed || !article.legalReviewed)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['status'],
            message: '發布前必須完成隱私與法律內容檢查。',
          });
        }
      }),
});

export const collections = { articles, categories, contentTypes };
