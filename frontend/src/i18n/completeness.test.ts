import { describe, expect, it } from 'vitest';
import { ar } from './ar';
import { en } from './en';

/**
 * 010 T034 — i18n completeness audit (contracts §6): every leaf key in
 * `en.ts` must exist in `ar.ts` and vice versa, and no leaf may be an empty
 * string. The `Dictionary` type already enforces the en→ar direction at
 * compile time; this test also catches the reverse direction and empty
 * values, which types cannot.
 */

type Dict = Record<string, unknown>;

/** Recursively collects dotted leaf-key paths from a dictionary object. */
function leafKeys(node: Dict, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    const path = prefix.length > 0 ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      keys.push(...leafKeys(value as Dict, path));
    } else {
      keys.push(path);
    }
  }
  return keys.sort();
}

/** Recursively collects leaf paths whose value is an empty/whitespace string. */
function emptyLeaves(node: Dict, prefix = ''): string[] {
  const empty: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    const path = prefix.length > 0 ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      empty.push(...emptyLeaves(value as Dict, path));
    } else if (typeof value !== 'string' || value.trim().length === 0) {
      empty.push(path);
    }
  }
  return empty;
}

describe('i18n dictionary completeness (en ↔ ar)', () => {
  const enKeys = leafKeys(en as Dict);
  const arKeys = leafKeys(ar as Dict);

  it('has identical leaf key sets in both dictionaries', () => {
    const missingInAr = enKeys.filter((key) => !arKeys.includes(key));
    const missingInEn = arKeys.filter((key) => !enKeys.includes(key));
    expect(missingInAr, `keys missing from ar.ts: ${missingInAr.join(', ')}`).toEqual([]);
    expect(missingInEn, `keys missing from en.ts: ${missingInEn.join(', ')}`).toEqual([]);
  });

  it('has no empty or non-string leaf values in en.ts', () => {
    expect(emptyLeaves(en as Dict)).toEqual([]);
  });

  it('has no empty or non-string leaf values in ar.ts', () => {
    expect(emptyLeaves(ar as Dict)).toEqual([]);
  });

  it('keeps interpolation placeholders consistent between languages', () => {
    const placeholderPattern = /\{[a-zA-Z]+\}/g;
    const lookup = (dict: Dict, path: string): string => {
      let node: unknown = dict;
      for (const part of path.split('.')) {
        node = (node as Dict)[part];
      }
      return String(node);
    };

    const mismatches: string[] = [];
    for (const key of enKeys) {
      const enPlaceholders = (lookup(en as Dict, key).match(placeholderPattern) ?? []).sort();
      const arPlaceholders = (lookup(ar as Dict, key).match(placeholderPattern) ?? []).sort();
      if (enPlaceholders.join(',') !== arPlaceholders.join(',')) {
        mismatches.push(
          `${key}: en=[${enPlaceholders.join(',')}] ar=[${arPlaceholders.join(',')}]`,
        );
      }
    }
    expect(mismatches, mismatches.join('\n')).toEqual([]);
  });
});
