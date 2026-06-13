import { describe, expect, it } from 'vitest';
import { escapeAttr, escapeText } from './htmlEscape';

describe('escapeText (research §3)', () => {
  it('neutralizes a script-tag injection', () => {
    expect(escapeText('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes ampersands, less-than, and greater-than', () => {
    expect(escapeText('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d');
  });

  it('leaves quotes alone in text content', () => {
    expect(escapeText(`"quoted" and 'single'`)).toBe(`"quoted" and 'single'`);
  });

  it('preserves newlines verbatim (rendered via pre-wrap, not <br>)', () => {
    expect(escapeText('line one\nline two\r\nline three')).toBe('line one\nline two\r\nline three');
    expect(escapeText('a\nb')).not.toContain('<br');
  });

  it('passes Arabic and emoji through unchanged', () => {
    expect(escapeText('مرحبا 👋')).toBe('مرحبا 👋');
  });

  it('is NOT idempotent by design — double escaping is visible, not hidden', () => {
    // A pre-escaped entity is escaped again: callers must escape exactly once.
    expect(escapeText('&amp;')).toBe('&amp;amp;');
  });

  it('handles the empty string', () => {
    expect(escapeText('')).toBe('');
  });
});

describe('escapeAttr (research §3)', () => {
  it('escapes double and single quotes in addition to text characters', () => {
    expect(escapeAttr(`"x" 'y' <z> & w`)).toBe('&quot;x&quot; &#39;y&#39; &lt;z&gt; &amp; w');
  });

  it('neutralizes an attribute-breakout payload', () => {
    const payload = '" onmouseover="alert(1)';
    const escaped = escapeAttr(payload);
    expect(escaped).not.toContain('"');
    expect(escaped).toBe('&quot; onmouseover=&quot;alert(1)');
  });

  it('neutralizes a single-quote breakout payload', () => {
    expect(escapeAttr("' onerror='x")).not.toContain("'");
  });
});
