export const NOTION_API_VERSION = '2026-03-11' as const;

export type NotionObject = Record<string, unknown>;

export interface NotionListResponse<T = NotionObject> {
  object: 'list';
  results: T[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface NotionPage extends NotionObject {
  object: 'page';
  id: string;
  url?: string;
  in_trash?: boolean;
  last_edited_time?: string;
  properties: Record<string, NotionProperty>;
}

export interface NotionProperty extends NotionObject {
  id: string;
  type: string;
}

export interface NotionRichText extends NotionObject {
  type: 'text' | 'mention' | 'equation';
  plain_text: string;
  href?: string | null;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
  };
  text?: { content?: string; link?: { url?: string } | null };
}

export interface NotionBlock extends NotionObject {
  object: 'block';
  id: string;
  type: string;
  has_children?: boolean;
  children?: NotionBlock[];
}

export type NormalizedMark =
  { type: 'bold' | 'italic' | 'underline' | 'strike' | 'code' } | { type: 'link'; href: string };

export interface NormalizedText {
  type: 'text';
  text: string;
  marks?: NormalizedMark[];
}

export interface NormalizedBlock {
  type:
    | 'paragraph'
    | 'heading'
    | 'bulletListItem'
    | 'numberedListItem'
    | 'quote'
    | 'code'
    | 'divider'
    | 'image';
  blockId: string;
  level?: 1 | 2 | 3;
  language?: string;
  content?: NormalizedText[];
  children?: NormalizedBlock[];
  mediaRef?: string;
  caption?: NormalizedText[];
}

export interface MediaSourceRef {
  blockId: string;
  kind: 'notion_file';
  /** Stable source identity used by canonical hashes. */
  canonicalRef: string;
  /** Fetch-only URL. Notion file URLs are temporary and excluded from canonical hashes. */
  fetchUrl: string;
  caption: string;
}

export interface ConvertedNotionDocument {
  version: 1;
  blocks: NormalizedBlock[];
  searchText: string;
  mediaSourceRefs: MediaSourceRef[];
}

export type NormalizedPropertyValue =
  | null
  | string
  | number
  | boolean
  | string[]
  | { start: string; end: string | null; timeZone: string | null }
  | { type: string; value: unknown };

export interface MappedPageProperties {
  title: string;
  description: string;
  tags: string[];
  slug: string | null;
  values: Record<string, NormalizedPropertyValue>;
}

export interface NotionSourceSnapshot {
  pageId: string;
  sourceState: 'active' | 'archived';
  lastEditedTime: string | null;
  url: string | null;
  properties: MappedPageProperties;
  document: ConvertedNotionDocument;
}
