import { describe, expect, it } from 'vitest';
import keystaticConfig from '../../keystatic.config';

describe('Keystatic content organization', () => {
  it('separates article editing from reusable content settings', () => {
    expect(keystaticConfig.ui?.navigation).toEqual({
      內容編輯: ['articles'],
      內容設定: ['contentTypes', 'categories'],
    });
    expect(keystaticConfig.collections?.articles.label).toBe('文章內容');
    expect(keystaticConfig.collections?.contentTypes.label).toBe('內容類型');
    expect(keystaticConfig.collections?.categories.label).toBe('文章分類');
  });
});
