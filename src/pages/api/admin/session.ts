import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/admin/auth';
import { errorResponse, json } from '@/lib/admin/http';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    return json({ user: await requireAdmin(request) });
  } catch (error) {
    return errorResponse(error);
  }
};
