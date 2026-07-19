import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/admin/auth';
import { json } from '@/lib/admin/http';
import { contentJobErrorResponse, readJson } from '@/lib/content-jobs/http';
import { getContentJobService } from '@/lib/content-jobs/service';
import { parseDirectSyncRequest } from '@/lib/content-jobs/validation';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    const input = parseDirectSyncRequest(await readJson(request));
    const result = await getContentJobService().syncSourceNow(input);
    return json({ accepted: true, result });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
};
