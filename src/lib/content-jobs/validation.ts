export class RequestValidationError extends Error {
  readonly status = 400;
}

export interface PublishRequest {
  expectedRevisionId: string;
  expectedMetadataVersion: number;
  expectedCandidateHash: string;
  idempotencyKey: string;
}

export interface AttestationRequest {
  candidateHash: string;
  reviewType: 'privacy' | 'legal';
  action: 'attest' | 'revoke';
  reason: string | null;
  idempotencyKey: string;
}

export interface UnpublishRequest {
  expectedPublicationVersion: number;
  reason: string | null;
  idempotencyKey: string;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RequestValidationError('Request body must be a JSON object.');
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, name: string, maxLength = 256): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new RequestValidationError(`${name} is invalid.`);
  }
  return value;
}

function optionalReason(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requiredString(value, 'reason', 1000);
}

function nonNegativeInteger(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new RequestValidationError(`${name} must be a non-negative integer.`);
  }
  return value as number;
}

export function parseLimit(value: string | null, fallback = 25, maximum = 100): number {
  if (value === null || value === '') return fallback;
  if (!/^\d+$/.test(value)) throw new RequestValidationError('limit must be an integer.');
  const limit = Number(value);
  if (limit < 1 || limit > maximum) {
    throw new RequestValidationError(`limit must be between 1 and ${maximum}.`);
  }
  return limit;
}

export function parseDirectSyncRequest(value: unknown): {
  sourceId?: string;
  pageId?: string;
} {
  const input = record(value);
  const sourceId =
    input.sourceId === undefined ? undefined : requiredString(input.sourceId, 'sourceId', 128);
  const pageId =
    input.pageId === undefined ? undefined : requiredString(input.pageId, 'pageId', 128);
  if ((sourceId ? 1 : 0) + (pageId ? 1 : 0) !== 1) {
    throw new RequestValidationError('Exactly one of sourceId or pageId is required.');
  }
  return { sourceId, pageId };
}

export function parseBindRequest(value: unknown): { articleId: string } {
  const input = record(value);
  return { articleId: requiredString(input.articleId, 'articleId', 128) };
}

export function parseSourceSummaryRequest(value: unknown): {
  summary: string;
  expectedWorkingCopyVersion: number;
} {
  const input = record(value);
  return {
    summary: requiredString(input.summary, 'summary', 180),
    expectedWorkingCopyVersion: nonNegativeInteger(
      input.expectedWorkingCopyVersion,
      'expectedWorkingCopyVersion',
    ),
  };
}

export function parseFeaturedArticleRequest(value: unknown): { featured: boolean } {
  const input = record(value);
  if (typeof input.featured !== 'boolean') {
    throw new RequestValidationError('featured must be a boolean.');
  }
  return { featured: input.featured };
}

function parseClassification(value: unknown): { category: string; tags: string[] } {
  const input = record(value);
  const category = requiredString(input.category, 'category', 100).trim();
  if (!category) throw new RequestValidationError('category is invalid.');
  if (!Array.isArray(input.tags) || input.tags.length > 20) {
    throw new RequestValidationError('tags must contain at most 20 items.');
  }
  const tags: string[] = [];
  for (const value of input.tags) {
    if (typeof value !== 'string') throw new RequestValidationError('tags are invalid.');
    const tag = value.trim();
    if (!tag) continue;
    if (tag.length > 40) throw new RequestValidationError('tags are invalid.');
    if (!tags.includes(tag)) tags.push(tag);
  }
  return { category, tags };
}

export function parseArticleClassificationRequest(value: unknown): {
  category: string;
  tags: string[];
} {
  return parseClassification(value);
}

export function parseSourceClassificationRequest(value: unknown): {
  category: string;
  tags: string[];
  expectedWorkingCopyVersion: number;
} {
  const input = record(value);
  return {
    ...parseClassification(input),
    expectedWorkingCopyVersion: nonNegativeInteger(
      input.expectedWorkingCopyVersion,
      'expectedWorkingCopyVersion',
    ),
  };
}

export function parsePrepareRequest(value: unknown): {
  expectedWorkingCopyVersion?: number;
  expectedPublicationVersion?: number;
  slug?: string;
} {
  const input = record(value);
  const parseOptional = (name: string) =>
    input[name] === undefined ? undefined : nonNegativeInteger(input[name], name);
  return {
    expectedWorkingCopyVersion: parseOptional('expectedWorkingCopyVersion'),
    expectedPublicationVersion: parseOptional('expectedPublicationVersion'),
    slug:
      input.slug === undefined || input.slug === null
        ? undefined
        : requiredString(input.slug, 'slug', 120),
  };
}

export function parseAttestationRequest(value: unknown): AttestationRequest {
  const input = record(value);
  if (input.reviewType !== 'privacy' && input.reviewType !== 'legal') {
    throw new RequestValidationError('reviewType must be privacy or legal.');
  }
  if (input.action !== 'attest' && input.action !== 'revoke') {
    throw new RequestValidationError('action must be attest or revoke.');
  }
  return {
    candidateHash: requiredString(input.candidateHash, 'candidateHash', 256),
    reviewType: input.reviewType,
    action: input.action,
    reason: optionalReason(input.reason),
    idempotencyKey: requiredString(input.idempotencyKey, 'idempotencyKey', 128),
  };
}

export function parsePublishRequest(value: unknown): PublishRequest {
  const input = record(value);
  return {
    expectedRevisionId: requiredString(input.expectedRevisionId, 'expectedRevisionId', 128),
    expectedMetadataVersion: nonNegativeInteger(
      input.expectedMetadataVersion,
      'expectedMetadataVersion',
    ),
    expectedCandidateHash: requiredString(
      input.expectedCandidateHash,
      'expectedCandidateHash',
      256,
    ),
    idempotencyKey: requiredString(input.idempotencyKey, 'idempotencyKey', 128),
  };
}

export function parseUnpublishRequest(value: unknown): UnpublishRequest {
  const input = record(value);
  return {
    expectedPublicationVersion: nonNegativeInteger(
      input.expectedPublicationVersion,
      'expectedPublicationVersion',
    ),
    reason: optionalReason(input.reason),
    idempotencyKey: requiredString(input.idempotencyKey, 'idempotencyKey', 128),
  };
}
