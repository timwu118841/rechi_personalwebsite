import { describe, expect, it } from 'vitest';
import { normalizeTextAppearanceAttrs, normalizeTextMarks } from './text-appearance';

describe('text appearance contract', () => {
  it('accepts only exact bounded values and omits invalid fields independently', () => {
    expect(normalizeTextAppearanceAttrs({ size: 'small', color: 'DANGER', extra: 'x' })).toEqual({
      size: 'small',
    });
    expect(normalizeTextAppearanceAttrs({ size: 'default', color: 'accent' })).toEqual({
      color: 'accent',
    });
    expect(normalizeTextAppearanceAttrs({ size: 1, color: null })).toBeUndefined();
  });

  it('merges duplicate marks by dimension, preserving earlier values when later values are invalid', () => {
    expect(
      normalizeTextMarks([
        { type: 'bold' },
        { type: 'textAppearance', attrs: { size: 'small', color: 'muted' } },
        { type: 'textAppearance', attrs: { size: 'large', color: 'unknown' } },
      ]),
    ).toEqual([
      { type: 'bold' },
      { type: 'textAppearance', attrs: { size: 'large', color: 'muted' } },
    ]);
  });

  it('removes empty appearance marks without changing other marks', () => {
    expect(
      normalizeTextMarks([
        { type: 'textAppearance', attrs: { color: 'invalid' } },
        { type: 'italic' },
      ]),
    ).toEqual([{ type: 'italic' }]);
  });
});
