import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/admin/auth';
import { json } from '@/lib/admin/http';
import { contentJobErrorResponse, readJson } from '@/lib/content-jobs/http';
import { getContentJobService } from '@/lib/content-jobs/service';
import { parseIgnoredFlag, RequestValidationError } from '@/lib/content-jobs/validation';

export const prerender = false;

/**
 * Retire or restore one synced Notion source. Retiring keeps the revisions, working
 * copy, and any published article; it only stops synchronization and candidate
 * creation, and it is reversible.
 */
export const PATCH: APIRoute = async ({ request, params }) => {
  try {
    const admin = await requireAdmin(request);
    if (!params.id) throw new RequestValidationError('source id is required.');
    const ignored = parseIgnoredFlag(await readJson(request));
    const sources = await getContentJobService().setSourcesIgnored([params.id], ignored, admin.id);
    return json({ sources });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
};
