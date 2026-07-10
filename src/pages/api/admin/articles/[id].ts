import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/admin/auth';
import { errorResponse, invalidateContent, json } from '@/lib/admin/http';
import { getContentRepository } from '@/lib/content/repository';
import { articleInputSchema } from '@/lib/content/validation';

export const prerender = false;

export const GET: APIRoute = async ({ request, params }) => {
  try {
    await requireAdmin(request);
    const article = await getContentRepository().getAdminArticle(params.id || '');
    return article ? json({ article }) : json({ message: '找不到文章。' }, { status: 404 });
  } catch (error) {
    return errorResponse(error);
  }
};

export const PUT: APIRoute = async (context) => {
  try {
    await requireAdmin(context.request);
    const repository = getContentRepository();
    const previous = await repository.getAdminArticle(context.params.id || '');
    if (!previous) return json({ message: '找不到文章。' }, { status: 404 });
    const input = articleInputSchema.parse(await context.request.json());
    const article = await repository.saveArticle(input, previous.id);
    await invalidateContent(context, [`article:${previous.slug}`, `article:${article.slug}`]);
    return json({ article });
  } catch (error) {
    return errorResponse(error);
  }
};
