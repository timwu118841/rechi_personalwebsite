import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/admin/auth';
import { json } from '@/lib/admin/http';
import { contentJobErrorResponse, readJson } from '@/lib/content-jobs/http';
import { getContentJobService } from '@/lib/content-jobs/service';
import {
  parseSourceClassificationRequest,
  RequestValidationError,
} from '@/lib/content-jobs/validation';

export const prerender = false;

export const PATCH: APIRoute = async ({ request, params }) => {
  try {
    await requireAdmin(request);
    if (!params.id) throw new RequestValidationError('source id is required.');
    const input = parseSourceClassificationRequest(await readJson(request));
    const workingCopy = await getContentJobService().updateSourceClassification(
      params.id,
      input.expectedWorkingCopyVersion,
      input.category,
      input.tags,
    );
    return json({ workingCopy });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
};
