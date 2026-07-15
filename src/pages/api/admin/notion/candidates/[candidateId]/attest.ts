import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/admin/auth';
import { json } from '@/lib/admin/http';
import { contentJobErrorResponse, readJson } from '@/lib/content-jobs/http';
import { getContentJobService } from '@/lib/content-jobs/service';
import { parseAttestationRequest, RequestValidationError } from '@/lib/content-jobs/validation';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
  try {
    const admin = await requireAdmin(request);
    const candidateId = params.candidateId;
    if (!candidateId) throw new RequestValidationError('candidateId is required.');
    const attestation = await getContentJobService().attestReview(
      candidateId,
      admin.id,
      parseAttestationRequest(await readJson(request)),
    );
    return json({ attestation }, { status: 201 });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
};
