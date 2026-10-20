import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/admin/auth';
import { invalidateContent, json } from '@/lib/admin/http';
import { contentJobErrorResponse } from '@/lib/content-jobs/http';
import { getContentJobService } from '@/lib/content-jobs/service';

export const prerender = false;

/**
 * Run queued content jobs on demand from the authenticated admin console.
 * A completed publication rewrites public content, so the cached pages are
 * invalidated in the same request instead of waiting for the TTL.
 */
export const POST: APIRoute = async (context) => {
  try {
    await requireAdmin(context.request);
    const result = await getContentJobService().runWorker();
    if (result.completed > 0) await invalidateContent(context);
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
