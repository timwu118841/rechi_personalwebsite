import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/admin/auth';
import { json } from '@/lib/admin/http';
import { contentJobErrorResponse, readJson } from '@/lib/content-jobs/http';
import { getContentJobService } from '@/lib/content-jobs/service';
import { parseBindRequest, RequestValidationError } from '@/lib/content-jobs/validation';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
  try {
    await requireAdmin(request);
    if (!params.id) throw new RequestValidationError('source id is required.');
    return json({
      workingCopy: await getContentJobService().bindSource(
        params.id,
        parseBindRequest(await readJson(request)).articleId,
      ),
    });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
};
