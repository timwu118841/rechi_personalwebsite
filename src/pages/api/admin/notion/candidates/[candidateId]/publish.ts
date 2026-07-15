import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/admin/auth';
import { json } from '@/lib/admin/http';
import { contentJobErrorResponse, readJson } from '@/lib/content-jobs/http';
import { getContentJobService } from '@/lib/content-jobs/service';
import { parsePublishRequest, RequestValidationError } from '@/lib/content-jobs/validation';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
  try {
    const admin = await requireAdmin(request);
    const candidateId = params.candidateId;
    if (!candidateId) throw new RequestValidationError('candidateId is required.');
    const immediate = new URL(request.url).searchParams.get('immediate') === 'true';
    const publication = await getContentJobService().requestPublish(
      candidateId,
      admin.id,
      parsePublishRequest(await readJson(request)),
      { immediate },
    );
    return json({ accepted: true, publication }, { status: 202 });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
};
