import { errorResponse, json, readJsonBody } from '@/lib/admin/http';
import { RequestValidationError } from '@/lib/content-jobs/validation';

export async function readJson(request: Request): Promise<unknown> {
  return readJsonBody(request);
}

export function contentJobErrorResponse(error: unknown): Response {
  if (error instanceof RequestValidationError) {
    return json({ message: error.message }, { status: error.status });
  }
  return errorResponse(error);
}
