import { describe, expect, it } from 'vitest';
import { inlineJson } from '../src/lib/json';

describe('inlineJson', () => {
  it('no deja cerrar la etiqueta script', () => {
    const out = inlineJson({ text: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('<');
    expect(JSON.parse(out)).toEqual({ text: '</script><script>alert(1)</script>' });
  });
});
