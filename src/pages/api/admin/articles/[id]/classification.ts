import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/admin/auth';
import { invalidateContent, json } from '@/lib/admin/http';
import { contentJobErrorResponse, readJson } from '@/lib/content-jobs/http';
import { getContentJobService } from '@/lib/content-jobs/service';
import {
  parseArticleClassificationRequest,
  RequestValidationError,
} from '@/lib/content-jobs/validation';
import { getContentRepository } from '@/lib/content/repository';
import { articleCacheTag } from '@/lib/content/slug';

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  try {
    const admin = await requireAdmin(context.request);
    const articleId = context.params.id;
    if (!articleId) throw new RequestValidationError('article id is required.');
    const article = await getContentRepository().getAdminArticle(articleId);
    if (!article) return json({ message: '找不到文章。' }, { status: 404 });
    const input = parseArticleClassificationRequest(await readJson(context.request));
    const updated = await getContentJobService().updateArticleClassification(
      articleId,
      input.category,
      input.tags,
      admin.id,
    );
    await invalidateContent(context, [articleCacheTag(article.slug), 'taxonomies']);
    return json({ article: updated });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
};
