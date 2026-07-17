import { describe, expect, it } from 'vitest';
import {
  parseAttestationRequest,
  parseEnqueueRequest,
  parseLimit,
  parsePrepareRequest,
  parsePublishRequest,
  parseUnpublishRequest,
} from './validation';

describe('content job request validation', () => {
  it('accepts root sync as an exclusive sync target', () => {
    expect(parseEnqueueRequest({ root: true, idempotencyKey: 'root-1' })).toEqual({
      root: true,
      idempotencyKey: 'root-1',
    });
    expect(() =>
      parseEnqueueRequest({ root: true, pageId: 'page-1', idempotencyKey: 'root-1' }),
    ).toThrow(/Exactly one/);
  });

  it('bounds status list limits', () => {
    expect(parseLimit(null)).toBe(25);
    expect(parseLimit('100')).toBe(100);
    expect(() => parseLimit('0')).toThrow(/between/);
    expect(() => parseLimit('101')).toThrow(/between/);
    expect(() => parseLimit('1.5')).toThrow(/integer/);
  });

  it('accepts the canonical review vocabulary only', () => {
    expect(
      parseAttestationRequest({
        candidateHash: 'candidate-hash',
        reviewType: 'privacy',
        action: 'attest',
        idempotencyKey: 'review-1',
      }),
    ).toMatchObject({ reviewType: 'privacy', action: 'attest', reason: null });
    expect(() =>
      parseAttestationRequest({
        candidateHash: 'candidate-hash',
        reviewType: 'security',
        action: 'attest',
        idempotencyKey: 'review-1',
      }),
    ).toThrow(/reviewType/);
  });

  it('requires CAS fields for publish and unpublish', () => {
    expect(
      parsePublishRequest({
        expectedRevisionId: 'revision-id',
        expectedMetadataVersion: 2,
        expectedCandidateHash: 'candidate-hash',
        idempotencyKey: 'publish-1',
      }),
    ).toMatchObject({ expectedMetadataVersion: 2 });
    expect(() =>
      parsePublishRequest({
        expectedRevisionId: 'revision-id',
        expectedMetadataVersion: -1,
        expectedCandidateHash: 'candidate-hash',
        idempotencyKey: 'publish-1',
      }),
    ).toThrow(/non-negative/);
    expect(
      parseUnpublishRequest({ expectedPublicationVersion: 3, idempotencyKey: 'unpublish-1' }),
    ).toMatchObject({ expectedPublicationVersion: 3 });
  });

  it('accepts an optional manual slug for candidate preparation', () => {
    expect(parsePrepareRequest({ slug: '  legal-note  ', expectedWorkingCopyVersion: 2 })).toEqual({
      slug: '  legal-note  ',
      expectedWorkingCopyVersion: 2,
    });
    expect(() => parsePrepareRequest({ slug: '' })).toThrow(/slug/);
  });
});
