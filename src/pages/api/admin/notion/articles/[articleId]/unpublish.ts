import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/admin/auth';
import { json } from '@/lib/admin/http';
import { contentJobErrorResponse, readJson } from '@/lib/content-jobs/http';
import { getContentJobService } from '@/lib/content-jobs/service';
import { parseUnpublishRequest, RequestValidationError } from '@/lib/content-jobs/validation';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
  try {
    const admin = await requireAdmin(request);
    const articleId = params.articleId;
    if (!articleId) throw new RequestValidationError('articleId is required.');
    const publication = await getContentJobService().unpublish(
      articleId,
      admin.id,
      parseUnpublishRequest(await readJson(request)),
    );
    return json({ publication });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
};
