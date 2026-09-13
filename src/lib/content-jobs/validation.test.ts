import { describe, expect, it } from 'vitest';
import {
  parseAttestationRequest,
  parseArticleClassificationRequest,
  parseDirectSyncRequest,
  parseFeaturedArticleRequest,
  parseIgnoredFlag,
  parseLimit,
  parsePrepareRequest,
  parsePublishRequest,
  parseSourceRetirementRequest,
  parseSourceSummaryRequest,
  parseSourceClassificationRequest,
  parseUnpublishRequest,
} from './validation';

describe('content job request validation', () => {
  it('accepts exactly one direct article sync target', () => {
    expect(parseDirectSyncRequest({ pageId: 'page-1' })).toEqual({
      pageId: 'page-1',
      sourceId: undefined,
    });
    expect(() => parseDirectSyncRequest({ dataSource: true })).toThrow(/Exactly one/);
    expect(() => parseDirectSyncRequest({ sourceId: 'source-1', pageId: 'page-1' })).toThrow(
      /Exactly one/,
    );
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

  it('requires a manual source summary with a working-copy version', () => {
    expect(
      parseSourceSummaryRequest({
        summary: '這是一段由管理者撰寫且符合長度要求的文章摘要。',
        expectedWorkingCopyVersion: 4,
      }),
    ).toEqual({
      summary: '這是一段由管理者撰寫且符合長度要求的文章摘要。',
      expectedWorkingCopyVersion: 4,
    });
    expect(() => parseSourceSummaryRequest({ summary: '', expectedWorkingCopyVersion: 4 })).toThrow(
      /summary/,
    );
  });

  it('accepts only an explicit boolean for featured article changes', () => {
    expect(parseFeaturedArticleRequest({ featured: true })).toEqual({ featured: true });
    expect(parseFeaturedArticleRequest({ featured: false })).toEqual({ featured: false });
    expect(() => parseFeaturedArticleRequest({ featured: 'true' })).toThrow(/featured/);
  });

  it('normalizes article categories and tags for Admin-managed classification', () => {
    expect(
      parseArticleClassificationRequest({
        category: 'legal-practice',
        tags: [' 勞動法 ', '契約', '勞動法', ''],
      }),
    ).toEqual({ category: 'legal-practice', tags: ['勞動法', '契約'] });
    expect(
      parseSourceClassificationRequest({
        category: 'legal-practice',
        tags: ['勞動法'],
        expectedWorkingCopyVersion: 5,
      }),
    ).toEqual({
      category: 'legal-practice',
      tags: ['勞動法'],
      expectedWorkingCopyVersion: 5,
    });
    expect(() => parseArticleClassificationRequest({ category: '', tags: ['勞動法'] })).toThrow(
      /category/,
    );
    expect(() =>
      parseArticleClassificationRequest({ category: 'legal-practice', tags: ['x'.repeat(41)] }),
    ).toThrow(/tags/);
  });
});

describe('source retirement request validation', () => {
  it('accepts a batch of source ids and de-duplicates them', () => {
    expect(
      parseSourceRetirementRequest({
        sourceIds: ['source-1', 'source-1', 'source-2'],
        ignored: true,
      }),
    ).toEqual({ sourceIds: ['source-1', 'source-2'], ignored: true });
  });

  it('rejects an empty batch, an oversized batch, and a non-boolean flag', () => {
    expect(() => parseSourceRetirementRequest({ sourceIds: [], ignored: true })).toThrow(
      'sourceIds must contain between 1 and 200 items.',
    );
    expect(() =>
      parseSourceRetirementRequest({
        sourceIds: Array.from({ length: 201 }, (_value, index) => `source-${index}`),
        ignored: true,
      }),
    ).toThrow('sourceIds must contain between 1 and 200 items.');
    expect(() => parseSourceRetirementRequest({ sourceIds: ['source-1'], ignored: 'yes' })).toThrow(
      'ignored must be a boolean.',
    );
    expect(() =>
      parseSourceRetirementRequest({ sourceIds: ['source-1', 7], ignored: true }),
    ).toThrow('sourceIds is invalid.');
  });

  it('reads the single-source flag used by the retirement route', () => {
    expect(parseIgnoredFlag({ ignored: false })).toBe(false);
    expect(() => parseIgnoredFlag({})).toThrow('ignored must be a boolean.');
  });
});
