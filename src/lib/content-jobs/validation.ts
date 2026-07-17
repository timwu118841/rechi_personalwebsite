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

export function parseEnqueueRequest(value: unknown): {
  sourceId?: string;
  pageId?: string;
  root?: true;
  idempotencyKey: string;
} {
  const input = record(value);
  const sourceId =
    input.sourceId === undefined ? undefined : requiredString(input.sourceId, 'sourceId', 128);
  const pageId =
    input.pageId === undefined ? undefined : requiredString(input.pageId, 'pageId', 128);
  const root = input.root === true ? true : undefined;
  if ((sourceId ? 1 : 0) + (pageId ? 1 : 0) + (root ? 1 : 0) !== 1) {
    throw new RequestValidationError('Exactly one of sourceId, pageId, or root is required.');
  }
  return {
    sourceId,
    pageId,
    root,
    idempotencyKey: requiredString(input.idempotencyKey, 'idempotencyKey', 128),
  };
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
