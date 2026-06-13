import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatSummary } from '@chatframe/shared';
import { ChatListItem } from './ChatListItem';
import { ChatList } from './ChatList';
import { useLanguageStore } from '../../stores/useLanguageStore';

// 30 days ago, local time, so the row always lands in the "older date" bucket.
const lastMessageDate = new Date();
lastMessageDate.setDate(lastMessageDate.getDate() - 30);
lastMessageDate.setHours(11, 5, 0, 0);

const chat: ChatSummary = {
  id: 'chat-001',
  displayName: 'Sarah Johnson',
  phoneNumber: '+14155550142',
  isGroup: false,
  lastMessagePreview: 'See you tomorrow! 😊',
  lastMessageAt: lastMessageDate.toISOString(),
};

beforeEach(() => {
  useLanguageStore.getState().setLanguage('en');
});

afterEach(() => {
  cleanup();
});

describe('ChatListItem (US1)', () => {
  it('renders name, phone, preview, and a relative timestamp', () => {
    render(<ChatListItem chat={chat} onSelect={vi.fn()} />);

    expect(screen.getByText('Sarah Johnson')).toBeTruthy();
    expect(screen.getByText('+14155550142')).toBeTruthy();
    expect(screen.getByText('See you tomorrow! 😊')).toBeTruthy();
    // Older-than-yesterday messages show a short date (FR-008); the year is
    // included only when it differs from the current year.
    const sameYear = lastMessageDate.getFullYear() === new Date().getFullYear();
    expect(
      screen.getByText(
        new Intl.DateTimeFormat('en-US', {
          ...(sameYear ? {} : { year: 'numeric' as const }),
          month: 'short',
          day: 'numeric',
        }).format(lastMessageDate),
      ),
    ).toBeTruthy();
  });

  it('renders a generated avatar with an accessible label (FR-009)', () => {
    render(<ChatListItem chat={chat} onSelect={vi.fn()} />);

    const avatar = screen.getByRole('img', { name: 'Avatar for Sarah Johnson' });
    expect(avatar.textContent).toBe('S');
  });

  it('falls back to the phone number as the display name (FR-004)', () => {
    render(<ChatListItem chat={{ ...chat, displayName: null }} onSelect={vi.fn()} />);

    // The phone appears as the primary label (and as the secondary line).
    expect(screen.getAllByText('+14155550142').length).toBeGreaterThan(0);
    expect(screen.queryByText('Sarah Johnson')).toBeNull();
  });

  it('falls back to "Unknown contact" when name and phone are missing', () => {
    render(
      <ChatListItem chat={{ ...chat, displayName: null, phoneNumber: null }} onSelect={vi.fn()} />,
    );

    expect(screen.getByText('Unknown contact')).toBeTruthy();
  });

  it('invokes onSelect with the chat when clicked', () => {
    const onSelect = vi.fn();
    render(<ChatListItem chat={chat} onSelect={onSelect} />);

    screen.getByRole('button').click();
    expect(onSelect).toHaveBeenCalledWith(chat);
  });
});

describe('ChatList empty state (FR-014)', () => {
  it('shows the no-chats message instead of a blank layout', () => {
    render(<ChatList chats={[]} onSelect={vi.fn()} />);

    expect(screen.getByText('No private chats found.')).toBeTruthy();
  });

  it('renders one row per chat', () => {
    render(
      <ChatList
        chats={[chat, { ...chat, id: 'chat-002', displayName: 'Omar' }]}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
