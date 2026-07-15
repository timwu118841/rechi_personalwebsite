import './server-only';
import type {
  MappedPageProperties,
  NormalizedPropertyValue,
  NotionProperty,
  NotionRichText,
} from './types';

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function richText(value: unknown): string {
  return Array.isArray(value)
    ? value
        .map((item) => object(item)?.plain_text)
        .filter((item): item is string => typeof item === 'string')
        .join('')
    : '';
}

function names(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((item) => object(item)?.name)
        .filter((item): item is string => typeof item === 'string')
    : [];
}

export function normalizeProperty(property: NotionProperty): NormalizedPropertyValue {
  const value = property[property.type];
  switch (property.type) {
    case 'title':
    case 'rich_text':
      return richText(value as NotionRichText[]);
    case 'select':
    case 'status':
      return (object(value)?.name as string | undefined) ?? null;
    case 'multi_select':
      return names(value);
    case 'checkbox':
      return typeof value === 'boolean' ? value : false;
    case 'number':
      return typeof value === 'number' ? value : null;
    case 'url':
    case 'email':
    case 'phone_number':
    case 'created_time':
    case 'last_edited_time':
      return typeof value === 'string' ? value : null;
    case 'date': {
      const date = object(value);
      return date && typeof date.start === 'string'
        ? {
            start: date.start,
            end: typeof date.end === 'string' ? date.end : null,
            timeZone: typeof date.time_zone === 'string' ? date.time_zone : null,
          }
        : null;
    }
    case 'people':
      return Array.isArray(value)
        ? value
            .map((person) => object(person)?.id)
            .filter((id): id is string => typeof id === 'string')
        : [];
    case 'relation':
      return Array.isArray(value)
        ? value
            .map((relation) => object(relation)?.id)
            .filter((id): id is string => typeof id === 'string')
        : [];
    case 'files':
      return Array.isArray(value)
        ? value
            .map((file) => {
              const entry = object(file);
              if (!entry) return null;
              return typeof entry.name === 'string' ? entry.name : null;
            })
            .filter((name): name is string => name !== null)
        : [];
    default:
      return { type: property.type, value: value ?? null };
  }
}

function findValue(
  values: Record<string, NormalizedPropertyValue>,
  candidates: string[],
): NormalizedPropertyValue | undefined {
  const wanted = new Set(candidates.map((candidate) => candidate.toLocaleLowerCase('en-US')));
  return Object.entries(values).find(([name]) => wanted.has(name.toLocaleLowerCase('en-US')))?.[1];
}

export function mapPageProperties(
  properties: Record<string, NotionProperty>,
): MappedPageProperties {
  const values = Object.fromEntries(
    Object.entries(properties)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, property]) => [name, normalizeProperty(property)]),
  );
  const title = findValue(values, ['title', 'name']);
  const description = findValue(values, ['description', 'summary']);
  const tags = findValue(values, ['tags', 'tag']);
  const slug = findValue(values, ['slug']);

  return {
    title: typeof title === 'string' ? title : '',
    description: typeof description === 'string' ? description : '',
    tags: Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : [],
    slug: typeof slug === 'string' && slug ? slug : null,
    values,
  };
}
