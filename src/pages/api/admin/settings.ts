import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/admin/auth';
import { errorResponse, invalidateContent, json, readJsonBody } from '@/lib/admin/http';
import { getContentRepository } from '@/lib/content/repository';
import { siteSettingsInputSchema } from '@/lib/content/validation';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    return json({ settings: await getContentRepository().getSiteSettings() });
  } catch (error) {
    return errorResponse(error);
  }
};

export const PUT: APIRoute = async (context) => {
  try {
    await requireAdmin(context.request);
    const settings = await getContentRepository().saveSiteSettings(
      siteSettingsInputSchema.parse(await readJsonBody(context.request)),
    );
    await invalidateContent(context, ['site-settings']);
    return json({ settings });
  } catch (error) {
    return errorResponse(error);
  }
};
