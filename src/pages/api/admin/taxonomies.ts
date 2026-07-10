import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/admin/auth';
import { errorResponse, invalidateContent, json } from '@/lib/admin/http';
import { getContentRepository } from '@/lib/content/repository';
import { categoryInputSchema, contentTypeInputSchema } from '@/lib/content/validation';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    const repository = getContentRepository();
    const [categories, contentTypes] = await Promise.all([
      repository.listCategories({ includeHidden: true }),
      repository.listContentTypes(),
    ]);
    return json({ categories, contentTypes });
  } catch (error) {
    return errorResponse(error);
  }
};

export const POST: APIRoute = async (context) => {
  try {
    await requireAdmin(context.request);
    const body = await context.request.json();
    const repository = getContentRepository();
    const item =
      body.kind === 'category'
        ? await repository.saveCategory(categoryInputSchema.parse(body.value))
        : await repository.saveContentType(contentTypeInputSchema.parse(body.value));
    await invalidateContent(context, ['taxonomies']);
    return json({ item });
  } catch (error) {
    return errorResponse(error);
  }
};
