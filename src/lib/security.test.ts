import { describe, expect, it } from 'vitest';
import { serializeJsonForHtmlScript } from '@/lib/security';

describe('serializeJsonForHtmlScript', () => {
  it('prevents user-controlled JSON from escaping its script element', () => {
    const value = {
      title: '</script><script>globalThis.compromised = true</script>',
      description: 'line\u2028separator\u2029test',
    };

    const serialized = serializeJsonForHtmlScript(value);

    expect(serialized).not.toContain('</script>');
    expect(serialized).not.toContain('<script>');
    expect(serialized).toContain('\\u003c/script>');
    expect(serialized).not.toContain('\u2028');
    expect(serialized).not.toContain('\u2029');
    expect(JSON.parse(serialized)).toEqual(value);
  });
});
