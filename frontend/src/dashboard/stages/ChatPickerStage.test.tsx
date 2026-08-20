import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatSummary } from '@chatframe/shared';
import { ChatPickerStage } from './ChatPickerStage';
import { useLanguageStore } from '../../stores/useLanguageStore';
import { useSessionStore } from '../../stores/useSessionStore';
import { useWorkflowStore } from '../../stores/useWorkflowStore';

const mockChats: ChatSummary[] = [
  {
    id: '971501234567@c.us',
    displayName: 'Ahmed Mohammed',
    phoneNumber: '+971501234567',
    isGroup: false,
    lastMessagePreview: 'See you tomorrow!',
    lastMessageAt: '2026-06-09T11:05:00.000Z',
  },
  {
    id: '971502345678@c.us',
    displayName: 'Sarah Ali',
    phoneNumber: '+971502345678',
    isGroup: false,
    lastMessagePreview: 'Thanks!',
    lastMessageAt: '2026-06-08T15:30:00.000Z',
  },
  {
    id: '971503456789@c.us',
    displayName: 'Omar Hassan',
    phoneNumber: '+971503456789',
    isGroup: false,
    lastMessagePreview: 'Got it',
    lastMessageAt: '2026-06-07T09:00:00.000Z',
  },
  {
    // Phone-based JID with no saved contact name — should show the phone number.
    id: '971504567890@s.whatsapp.net',
    displayName: null,
    phoneNumber: '+971504567890',
    isGroup: false,
    lastMessagePreview: 'Hello',
    lastMessageAt: '2026-06-06T12:00:00.000Z',
  },
  {
    // Privacy LID JID with no resolved name or phone — should show "Unknown contact",
    // NEVER the raw opaque LID digits.
    id: '222436708581508@lid',
    displayName: null,
    phoneNumber: null,
    isGroup: false,
    lastMessagePreview: '📷 Photo',
    lastMessageAt: '2026-06-05T08:00:00.000Z',
  },
];

vi.mock('../../api/chats.api', async () => {
  const actual = await vi.importActual('../../api/chats.api');
  return {
    ...actual,
    useChats: () => ({
      data: mockChats,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }),
  };
});

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  useLanguageStore.getState().setLanguage('en');
  useSessionStore.getState().reset();
  useWorkflowStore.getState().reset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ChatPickerStage workspace view', () => {
  it('renders the four status summary cards', () => {
    renderWithProviders(<ChatPickerStage />);
    expect(screen.getByText('Connected')).toBeTruthy();
    expect(screen.getByText('Not started')).toBeTruthy();
    expect(screen.getByText('Waiting for import')).toBeTruthy();
  });

  it('renders the chat list panel with mock chats', () => {
    renderWithProviders(<ChatPickerStage />);
    expect(screen.getAllByText('Select a chat').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Ahmed Mohammed')).toBeTruthy();
    expect(screen.getByText('Sarah Ali')).toBeTruthy();
    expect(screen.getByText('Omar Hassan')).toBeTruthy();
  });

  it('renders the center empty state canvas', () => {
    renderWithProviders(<ChatPickerStage />);
    expect(screen.getByText('Start a new import')).toBeTruthy();
    expect(screen.getByText('Choose Chat')).toBeTruthy();
  });

  it('renders the Import tab with import options', () => {
    renderWithProviders(<ChatPickerStage />);
    expect(screen.getByText('Import Options')).toBeTruthy();
    expect(screen.getByText('Text messages')).toBeTruthy();
    expect(screen.getByText('Images')).toBeTruthy();
    expect(screen.getByText('Voice messages')).toBeTruthy();
    expect(screen.getByText('Read receipts')).toBeTruthy();
  });

  it('renders the quality summary section', () => {
    renderWithProviders(<ChatPickerStage />);
    expect(screen.getByText('Quality Summary')).toBeTruthy();
    expect(screen.getByText('Duplicates removed')).toBeTruthy();
  });

  it('renders the bottom status bar', () => {
    renderWithProviders(<ChatPickerStage />);
    expect(screen.getByText('Ready to start a new import')).toBeTruthy();
    expect(screen.getByText('Idle')).toBeTruthy();
  });

  it('highlights a chat row when clicked', () => {
    renderWithProviders(<ChatPickerStage />);
    const chatRow = screen.getByText('Ahmed Mohammed').closest('button');
    expect(chatRow).toBeTruthy();
    if (chatRow) {
      fireEvent.click(chatRow);
      // After clicking, the row should have the selected background
      expect(chatRow.className).toContain('bg-[#F0FAF2]');
    }
  });

  it('shows search input in chat list', () => {
    renderWithProviders(<ChatPickerStage />);
    const searchInput = screen.getByPlaceholderText('Search by name or phone number');
    expect(searchInput).toBeTruthy();
  });

  it('renders the Start Import button as disabled', () => {
    renderWithProviders(<ChatPickerStage />);
    const importBtn = screen.getByText('Start Import').closest('button');
    expect(importBtn).toBeTruthy();
    expect(importBtn?.disabled).toBe(true);
  });

  it('renders tab navigation (Import, Quality, Export)', () => {
    renderWithProviders(<ChatPickerStage />);
    expect(screen.getAllByText('Import').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Quality').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Export').length).toBeGreaterThanOrEqual(1);
  });

  it('shows phone number for a contact with no saved name', () => {
    renderWithProviders(<ChatPickerStage />);
    // A phone-based JID with displayName=null should show the +digits phone.
    expect(screen.getByText('+971504567890')).toBeTruthy();
  });

  it('shows "Unknown contact" for a @lid chat with no name or phone — never the raw LID', () => {
    renderWithProviders(<ChatPickerStage />);
    // The @lid chat has no displayName and no phoneNumber. The list must show
    // the localized "Unknown contact" label, not the opaque LID digits.
    expect(screen.getAllByText('Unknown contact').length).toBeGreaterThanOrEqual(1);
    // The raw LID user part must NEVER appear in the document.
    expect(screen.queryByText('222436708581508')).toBeNull();
  });
});
