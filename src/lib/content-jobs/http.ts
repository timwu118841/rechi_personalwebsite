import { errorResponse, json } from '@/lib/admin/http';
import { RequestValidationError } from '@/lib/content-jobs/validation';

export async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new RequestValidationError('Content-Type must be application/json.');
  }
  try {
    return await request.json();
  } catch {
    throw new RequestValidationError('Request body must contain valid JSON.');
  }
}

export function contentJobErrorResponse(error: unknown): Response {
  if (error instanceof RequestValidationError) {
    return json({ message: error.message }, { status: error.status });
  }
  return errorResponse(error);
}
