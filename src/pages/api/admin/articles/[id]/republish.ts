import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/admin/auth';
import { invalidateContent, json } from '@/lib/admin/http';
import { contentJobErrorResponse, readJson } from '@/lib/content-jobs/http';
import { getContentJobService } from '@/lib/content-jobs/service';
import { parseArticleVersionRequest, RequestValidationError } from '@/lib/content-jobs/validation';
import { getContentRepository } from '@/lib/content/repository';
import { articleCacheTag } from '@/lib/content/slug';

export const prerender = false;

/** Put an unpublished article back online without waiting for a Notion sync. */
export const POST: APIRoute = async (context) => {
  try {
    const admin = await requireAdmin(context.request);
    const articleId = context.params.id;
    if (!articleId) throw new RequestValidationError('article id is required.');
    const article = await getContentRepository().getAdminArticle(articleId);
    if (!article) return json({ message: '找不到文章。' }, { status: 404 });
    const { expectedPublicationVersion } = parseArticleVersionRequest(
      await readJson(context.request),
    );
    const publication = await getContentJobService().republish(
      articleId,
      admin.id,
      expectedPublicationVersion,
    );
    await invalidateContent(context, [articleCacheTag(article.slug)]);
    return json({ publication });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
};
