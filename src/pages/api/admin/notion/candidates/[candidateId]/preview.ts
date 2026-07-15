import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/admin/auth';
import { json } from '@/lib/admin/http';
import { contentJobErrorResponse } from '@/lib/content-jobs/http';
import { getContentJobService } from '@/lib/content-jobs/service';
import { RequestValidationError } from '@/lib/content-jobs/validation';

export const prerender = false;

export const GET: APIRoute = async ({ request, params }) => {
  try {
    await requireAdmin(request);
    if (!params.candidateId) throw new RequestValidationError('candidate id is required.');
    const candidate = await getContentJobService().getCandidateStatus(params.candidateId);
    if (!candidate) return json({ message: 'Candidate not found.' }, { status: 404 });
    return json({
      preview: {
        candidateId: candidate.id,
        candidateHash: candidate.candidate_hash,
        state: candidate.state,
        title: candidate.title,
        description: candidate.description,
        bodyMarkdown: candidate.body_markdown,
        activationAt: candidate.activation_at,
        media: 'logical asset references are resolved only after promotion',
      },
    });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
};
