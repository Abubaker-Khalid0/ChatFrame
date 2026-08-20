import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatSummary } from '@chatframe/shared';
import { DashboardShell } from './DashboardShell';
import { useLanguageStore } from '../stores/useLanguageStore';
import { useWorkflowStore } from '../stores/useWorkflowStore';

const chats: ChatSummary[] = [
  {
    id: '14155550142@c.us',
    displayName: 'Sarah Johnson',
    phoneNumber: '+14155550142',
    isGroup: false,
    lastMessagePreview: 'See you tomorrow!',
    lastMessageAt: '2026-06-09T11:05:00.000Z',
  },
];

vi.mock('../api/chats.api', async () => {
  const actual = await vi.importActual('../api/chats.api');
  return {
    ...actual,
    useChats: () => ({
      data: chats,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }),
  };
});

function renderShell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardShell />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useLanguageStore.getState().setLanguage('en');
  useWorkflowStore.getState().reset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DashboardShell', () => {
  it('shows the onboarding stage until a language is chosen', () => {
    useLanguageStore.setState({ hasChosen: false });
    renderShell();

    expect(screen.getByText('Welcome to ChatFrame')).toBeTruthy();
    // No workspace rail before onboarding completes.
    expect(screen.queryByRole('navigation', { name: 'Workflow' })).toBeNull();
  });

  it('renders the rail, breadcrumb and the active stage once chosen', () => {
    useLanguageStore.setState({ hasChosen: true });
    useWorkflowStore.setState({ stage: 'chat-picker' });
    renderShell();

    // Rail navigation is present.
    expect(screen.getByRole('navigation', { name: 'Workflow' })).toBeTruthy();
    // Breadcrumb reflects the workspace label.
    expect(screen.getByText('Workspace')).toBeTruthy();
    // The chat-picker stage workspace is rendered.
    expect(screen.getAllByText('Select a chat').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Sarah Johnson')).toBeTruthy();
  });

  it('switches the rendered stage when the workflow stage changes', () => {
    useLanguageStore.setState({ hasChosen: true });
    useWorkflowStore.setState({
      selectedChat: { id: 'c', displayName: 'L', phoneNumber: null },
      stage: 'import-config',
    });
    renderShell();

    expect(screen.getByText('Import options')).toBeTruthy();
  });
});
