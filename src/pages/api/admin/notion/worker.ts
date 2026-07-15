import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/admin/auth';
import { json } from '@/lib/admin/http';
import { contentJobErrorResponse } from '@/lib/content-jobs/http';
import { getContentJobService } from '@/lib/content-jobs/service';

export const prerender = false;

/** Run queued content jobs on demand from the authenticated admin console. */
export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    const result = await getContentJobService().runWorker();
    return json({ accepted: true, result });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
};

export const ALL: APIRoute = async () =>
  new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' },
  });
