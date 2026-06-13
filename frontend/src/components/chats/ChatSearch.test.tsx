import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatSearch } from './ChatSearch';
import { useLanguageStore } from '../../stores/useLanguageStore';

function Harness() {
  const [value, setValue] = useState('');
  return <ChatSearch value={value} onChange={setValue} />;
}

beforeEach(() => {
  useLanguageStore.getState().setLanguage('en');
});

afterEach(() => {
  cleanup();
});

describe('ChatSearch (FR-010, FR-011)', () => {
  it('renders a labeled search input with the localized placeholder', () => {
    render(<Harness />);

    const input = screen.getByRole<HTMLInputElement>('searchbox', { name: 'Search chats' });
    expect(input.placeholder).toBe('Search by name or phone number');
  });

  it('reports typed values through onChange', () => {
    const onChange = vi.fn();
    render(<ChatSearch value="" onChange={onChange} />);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'أحمد' } });
    expect(onChange).toHaveBeenCalledWith('أحمد');
  });

  it('renders the controlled value', () => {
    render(<ChatSearch value="sarah" onChange={vi.fn()} />);

    expect(screen.getByRole<HTMLInputElement>('searchbox').value).toBe('sarah');
  });

  it('uses RTL direction when the active language is Arabic (SC-007)', () => {
    useLanguageStore.getState().setLanguage('ar');
    render(<Harness />);

    expect(screen.getByRole('searchbox').getAttribute('dir')).toBe('rtl');
  });

  it('uses LTR direction in English', () => {
    render(<Harness />);

    expect(screen.getByRole('searchbox').getAttribute('dir')).toBe('ltr');
  });
});
