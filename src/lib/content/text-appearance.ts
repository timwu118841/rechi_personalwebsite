import type { JSONContent } from '@tiptap/core';

export const TEXT_APPEARANCE_SIZES = ['small', 'large'] as const;
export const TEXT_APPEARANCE_COLORS = ['ink', 'muted', 'accent', 'danger'] as const;

export type TextAppearanceSize = (typeof TEXT_APPEARANCE_SIZES)[number];
export type TextAppearanceColor = (typeof TEXT_APPEARANCE_COLORS)[number];
export type TextAppearanceAttrs = {
  size?: TextAppearanceSize;
  color?: TextAppearanceColor;
};

const sizes = new Set<string>(TEXT_APPEARANCE_SIZES);
const colors = new Set<string>(TEXT_APPEARANCE_COLORS);

/** Return only canonical appearance attributes; invalid fields are omitted independently. */
export function normalizeTextAppearanceAttrs(value: unknown): TextAppearanceAttrs | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const attrs: TextAppearanceAttrs = {};
  if (typeof input.size === 'string' && sizes.has(input.size)) {
    attrs.size = input.size as TextAppearanceSize;
  }
  if (typeof input.color === 'string' && colors.has(input.color)) {
    attrs.color = input.color as TextAppearanceColor;
  }
  return attrs.size || attrs.color ? attrs : undefined;
}

/** Merge duplicate appearance marks in source order while retaining other marks. */
export function normalizeTextMarks(
  marks: Array<{ type?: string; attrs?: Record<string, unknown> }> | undefined,
): JSONContent['marks'] {
  const normalizedMarks: NonNullable<JSONContent['marks']> = [];
  const appearance: TextAppearanceAttrs = {};
  let appearanceIndex = -1;
  for (const mark of marks || []) {
    if (mark.type !== 'textAppearance') {
      if (mark.type) {
        normalizedMarks.push({
          type: mark.type,
          ...(mark.attrs ? { attrs: mark.attrs } : {}),
        });
      }
      continue;
    }
    if (appearanceIndex === -1) {
      appearanceIndex = normalizedMarks.length;
      normalizedMarks.push({ type: 'textAppearance', attrs: {} });
    }
    const attrs = normalizeTextAppearanceAttrs(mark.attrs);
    if (attrs?.size) appearance.size = attrs.size;
    if (attrs?.color) appearance.color = attrs.color;
  }
  if (appearance.size || appearance.color) {
    normalizedMarks[appearanceIndex] = { type: 'textAppearance', attrs: appearance };
  } else if (appearanceIndex !== -1) {
    normalizedMarks.splice(appearanceIndex, 1);
  }
  return normalizedMarks.length ? normalizedMarks : undefined;
}

export function appearanceDataAttrs(value: unknown) {
  const attrs = normalizeTextAppearanceAttrs(value);
  if (!attrs) return {};
  return {
    ...(attrs.size ? { 'data-editor-size': attrs.size } : {}),
    ...(attrs.color ? { 'data-editor-color': attrs.color } : {}),
  };
}
