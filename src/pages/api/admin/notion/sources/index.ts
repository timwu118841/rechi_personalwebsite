import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/admin/auth';
import { contentJobErrorResponse, readJson } from '@/lib/content-jobs/http';
import { getContentJobService } from '@/lib/content-jobs/service';
import { parseLimit, parseSourceRetirementRequest } from '@/lib/content-jobs/validation';
import { json } from '@/lib/admin/http';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  try {
    await requireAdmin(request);
    const limit = parseLimit(url.searchParams.get('limit'));
    const articleId = url.searchParams.get('articleId') || undefined;
    const view = url.searchParams.get('view');
    const normalizedView = view === 'active' || view === 'history' ? view : 'all';
    return json({
      sources: await getContentJobService().listSourceStatus(limit, articleId, normalizedView),
    });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
};

/** Retire or restore several synced sources in one all-or-nothing operation. */
export const POST: APIRoute = async ({ request }) => {
  try {
    const admin = await requireAdmin(request);
    const { sourceIds, ignored } = parseSourceRetirementRequest(await readJson(request));
    const sources = await getContentJobService().setSourcesIgnored(sourceIds, ignored, admin.id);
    return json({ sources });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
};
