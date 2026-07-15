import type { APIRoute } from 'astro';
import {
  hasCronSecret,
  isAuthorizedCronRequest,
  missingCronSecretResponse,
  privateResponse,
  unauthorizedCronResponse,
} from '@/lib/cron-auth';
import { getContentJobService } from '@/lib/content-jobs/service';

export const prerender = false;

function workerJson(data: unknown, status = 200): Response {
  return privateResponse(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export const GET: APIRoute = async ({ request }) => {
  if (!hasCronSecret()) return missingCronSecretResponse();
  if (!isAuthorizedCronRequest(request)) return unauthorizedCronResponse();
  try {
    return workerJson(await getContentJobService().runWorker());
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
