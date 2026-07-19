import './server-only';
import { createHash } from 'node:crypto';
import type { ConvertedNotionDocument, MappedPageProperties, MediaSourceRef } from './types';

export const NOTION_CANONICALIZATION_VERSION = 2 as const;
export const NOTION_CONVERTER_VERSION = 2 as const;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function canonicalMedia(
  refs: MediaSourceRef[],
): Array<Pick<MediaSourceRef, 'blockId' | 'kind' | 'canonicalRef' | 'caption'>> {
  return refs.map(({ blockId, kind, canonicalRef, caption }) => ({
    blockId,
    kind,
    canonicalRef,
    caption,
  }));
}

export function computeNotionHashes(input: {
  properties: MappedPageProperties;
  document: ConvertedNotionDocument;
  stagedMediaDigests?: string[];
}): { sourceHash: string; renderHash: string } {
  const sourceCanonical = {
    canonicalizationVersion: NOTION_CANONICALIZATION_VERSION,
    properties: input.properties,
    blocks: input.document.blocks,
    markdown: input.document.markdown,
    mediaSourceRefs: canonicalMedia(input.document.mediaSourceRefs),
  };
  const sourceHash = digest(sourceCanonical);
  const renderHash = digest({
    sourceHash,
    converterVersion: NOTION_CONVERTER_VERSION,
    document: {
      version: input.document.version,
      blocks: input.document.blocks,
      markdown: input.document.markdown,
      searchText: input.document.searchText,
    },
    stagedMediaDigests: [...(input.stagedMediaDigests ?? [])].sort(),
  });
  return { sourceHash, renderHash };
}
