import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/admin/auth';
import { invalidateContent, json } from '@/lib/admin/http';
import { contentJobErrorResponse, readJson } from '@/lib/content-jobs/http';
import { getContentJobService } from '@/lib/content-jobs/service';
import { parseUnpublishRequest, RequestValidationError } from '@/lib/content-jobs/validation';
import { getContentRepository } from '@/lib/content/repository';
import { articleCacheTag } from '@/lib/content/slug';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    const admin = await requireAdmin(context.request);
    const articleId = context.params.articleId;
    if (!articleId) throw new RequestValidationError('articleId is required.');
    const article = await getContentRepository().getAdminArticle(articleId);
    if (!article) return json({ message: '找不到文章。' }, { status: 404 });
    const publication = await getContentJobService().unpublish(
      articleId,
      admin.id,
      parseUnpublishRequest(await readJson(context.request)),
    );
    await invalidateContent(context, [articleCacheTag(article.slug)]);
    return json({ publication });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
};
