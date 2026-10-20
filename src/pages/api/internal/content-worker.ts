import type { APIRoute } from 'astro';
import {
  hasCronSecret,
  isAuthorizedCronRequest,
  missingCronSecretResponse,
  privateResponse,
  unauthorizedCronResponse,
} from '@/lib/cron-auth';
import { invalidateContent } from '@/lib/admin/http';
import { getContentJobService } from '@/lib/content-jobs/service';

export const prerender = false;

function workerJson(data: unknown, status = 200): Response {
  return privateResponse(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export const GET: APIRoute = async (context) => {
  if (!hasCronSecret()) return missingCronSecretResponse();
  if (!isAuthorizedCronRequest(context.request)) return unauthorizedCronResponse();
  try {
    const result = await getContentJobService().runWorker();
    // Cron can finalize publications; drop the cached public pages so the new
    // article is visible without waiting for the 24h TTL.
    if (result.completed > 0) await invalidateContent(context);
    return workerJson(result);
  } catch (error) {
    console.error('Content worker failed.', error);
    return workerJson({ message: 'Content worker failed.' }, 500);
  }
};

export const ALL: APIRoute = async () =>
  privateResponse('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'GET' },
  });
