import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/admin/auth';
import { json } from '@/lib/admin/http';
import { contentJobErrorResponse } from '@/lib/content-jobs/http';
import { getContentJobService } from '@/lib/content-jobs/service';
import { parseLimit } from '@/lib/content-jobs/validation';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  try {
    await requireAdmin(request);
    const limit = parseLimit(url.searchParams.get('limit'));
    const articleId = url.searchParams.get('articleId') || undefined;
    const view = url.searchParams.get('view');
    const normalizedView = view === 'active' || view === 'history' ? view : 'all';
    return json({
      candidates: await getContentJobService().listCandidateStatus(limit, articleId, normalizedView),
    });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
};
