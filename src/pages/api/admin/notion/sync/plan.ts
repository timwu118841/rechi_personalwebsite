import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/admin/auth';
import { json } from '@/lib/admin/http';
import { contentJobErrorResponse } from '@/lib/content-jobs/http';
import { getContentJobService } from '@/lib/content-jobs/service';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    return json({ plan: await getContentJobService().planDataSourceSync() });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
};

export const ALL: APIRoute = async () =>
  new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'GET' },
  });
