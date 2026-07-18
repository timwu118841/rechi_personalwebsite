import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/admin/auth';
import { errorResponse, invalidateContent, json, readJsonBody } from '@/lib/admin/http';
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
    const body = await readJsonBody(context.request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ message: '請提供有效的分類設定。' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    if (input.kind !== 'category' && input.kind !== 'contentType') {
      return json({ message: '不支援的分類設定類型。' }, { status: 400 });
    }
    const repository = getContentRepository();
    const item =
      input.kind === 'category'
        ? await repository.saveCategory(categoryInputSchema.parse(input.value))
        : await repository.saveContentType(contentTypeInputSchema.parse(input.value));
    await invalidateContent(context, ['taxonomies']);
    return json({ item });
  } catch (error) {
    return errorResponse(error);
  }
};
