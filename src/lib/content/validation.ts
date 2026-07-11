import { z } from 'astro/zod';
import { normalizeSlug } from './slug';

const optionalUrl = z.union([z.literal(''), z.url()]).optional();
const mediaSchema = z
  .object({
    url: z.url().or(z.string().startsWith('/')),
    alt: z.string().min(1).max(240),
    width: z.number().int().positive().max(12000),
    height: z.number().int().positive().max(12000),
  })
  .optional();

export const articleInputSchema = z
  .object({
    slug: z.string().transform((value, context) => {
      if (!value.trim()) return '';
      try {
        return normalizeSlug(value);
      } catch (error) {
        context.addIssue({ code: 'custom', message: error instanceof Error ? error.message : '網址代稱格式錯誤。' });
        return z.NEVER;
      }
    }),
    title: z.string().min(1).max(120),
    description: z.string().min(20).max(180),
    body: z.string().default(''),
    bodyJson: z.unknown().optional(),
    status: z.enum(['draft', 'published', 'unpublished']),
    publishedAt: z.coerce.date(),
    contentType: z.string().min(1).max(100),
    category: z.string().min(1).max(100),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    featured: z.boolean().default(false),
    cover: mediaSchema,
    seoTitle: z.string().max(70).optional(),
    seoDescription: z.string().max(180).optional(),
    canonicalUrl: optionalUrl,
    privacyReviewed: z.boolean().default(false),
    legalReviewed: z.boolean().default(false),
  })
  .superRefine((article, context) => {
    if (!article.body.trim() && (!article.bodyJson || typeof article.bodyJson !== 'object')) {
      context.addIssue({ code: 'custom', path: ['body'], message: '文章內容不可為空。' });
    }
    if (article.status === 'published' && (!article.privacyReviewed || !article.legalReviewed)) {
      context.addIssue({
        code: 'custom',
        path: ['status'],
        message: '發布前必須完成隱私與法律內容檢查。',
      });
    }
  });

export const siteSettingsInputSchema = z.object({
  siteTitle: z.string().min(1).max(80),
  shortTitle: z.string().min(1).max(30),
  siteDescription: z.string().min(20).max(180),
  authorName: z.string().min(1).max(80),
  authorRole: z.string().min(1).max(80),
  authorBio: z.string().min(20).max(600),
  authorImage: mediaSchema,
  defaultSocialImage: mediaSchema,
});

export const categoryInputSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(180),
  order: z.number().int().min(0).max(10000),
  visible: z.boolean(),
});

export const contentTypeInputSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(180),
});

export function validationError(error: z.ZodError) {
  return Object.fromEntries(
    error.issues.map((issue) => [issue.path.join('.') || 'form', issue.message]),
  );
}
