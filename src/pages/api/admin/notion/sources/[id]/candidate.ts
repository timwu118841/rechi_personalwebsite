import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/admin/auth';
import { json } from '@/lib/admin/http';
import { contentJobErrorResponse, readJson } from '@/lib/content-jobs/http';
import { getContentJobService } from '@/lib/content-jobs/service';
import { parsePrepareRequest, RequestValidationError } from '@/lib/content-jobs/validation';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
  try {
    const admin = await requireAdmin(request);
    if (!params.id) throw new RequestValidationError('source id is required.');
    const input = parsePrepareRequest(await readJson(request));
    const candidate = await getContentJobService().prepareCandidate(
      params.id,
      admin.id,
      input.expectedWorkingCopyVersion,
      input.expectedPublicationVersion,
      input.slug,
    );
    return json({ candidate }, { status: 201 });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
};
