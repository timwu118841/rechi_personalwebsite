import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/admin/auth';
import { errorResponse, invalidateContent, json } from '@/lib/admin/http';
import { getContentRepository } from '@/lib/content/repository';
import { articleCacheTag } from '@/lib/content/slug';
import { articleInputSchema } from '@/lib/content/validation';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    return json({ articles: await getContentRepository().listAdminArticles() });
  } catch (error) {
    return errorResponse(error);
  }
};

export const POST: APIRoute = async (context) => {
  try {
    await requireAdmin(context.request);
    const input = articleInputSchema.parse(await context.request.json());
    const article = await getContentRepository().saveArticle(input);
    await invalidateContent(context, [articleCacheTag(article.slug)]);
    return json({ article }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
};
