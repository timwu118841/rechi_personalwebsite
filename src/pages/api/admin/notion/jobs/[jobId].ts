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
    if (!params.jobId) throw new RequestValidationError('jobId is required.');
    const job = await getContentJobService().getJobStatus(params.jobId);
    return job ? json({ job }) : json({ message: 'Job not found.' }, { status: 404 });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
};
