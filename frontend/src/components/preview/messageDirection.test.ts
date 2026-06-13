import { describe, expect, it } from 'vitest';
import { messageDirection } from './messageDirection';

describe('messageDirection (FR-022, research §5)', () => {
  it('resolves Arabic-only text to rtl', () => {
    expect(messageDirection('السلام عليكم! كيف حالك اليوم؟')).toBe('rtl');
  });

  it('resolves English-only text to ltr', () => {
    expect(messageDirection('Good, thanks! Are we still on?')).toBe('ltr');
  });

  it('resolves mixed Arabic/English text to auto', () => {
    expect(messageDirection('نعم أكيد، the meeting is at 2pm إن شاء الله')).toBe('auto');
  });

  it('resolves emoji-only text to auto', () => {
    expect(messageDirection('👍😊🎉')).toBe('auto');
  });

  it('resolves number-only text to ltr', () => {
    expect(messageDirection('123456')).toBe('ltr');
  });

  it('resolves empty and undefined text to auto', () => {
    expect(messageDirection('')).toBe('auto');
    expect(messageDirection(undefined)).toBe('auto');
  });

  it('treats Arabic with embedded digits as rtl (digits are weak)', () => {
    expect(messageDirection('الساعة 10 صباحاً')).toBe('rtl');
  });
});
