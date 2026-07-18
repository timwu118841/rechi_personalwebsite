import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/admin/auth';
import { json } from '@/lib/admin/http';
import { contentJobErrorResponse, readJson } from '@/lib/content-jobs/http';
import { getContentJobService } from '@/lib/content-jobs/service';
import { parseEnqueueRequest } from '@/lib/content-jobs/validation';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const admin = await requireAdmin(request);
    const input = parseEnqueueRequest(await readJson(request));
    const service = getContentJobService();
    const job = input.dataSource
      ? await service.enqueueDataSourceSync({
          actorId: admin.id,
          idempotencyKey: input.idempotencyKey,
        })
      : await service.enqueueSourceSync({ ...input, actorId: admin.id });
    return json({ accepted: true, job }, { status: 202 });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
};
