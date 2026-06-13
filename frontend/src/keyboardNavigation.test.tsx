import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WelcomePage } from './pages/WelcomePage';
import { ImportPage } from './pages/ImportPage';
import { ExportCompletePage } from './pages/ExportCompletePage';
import { StepHeader } from './components/layout/StepHeader';
import { ErrorState } from './components/common/ErrorState';
import { EmptyState } from './components/common/EmptyState';
import { useLanguageStore } from './stores/useLanguageStore';

/**
 * 010 T059 — keyboard navigation audit (research §12).
 *
 * jsdom has no layout engine, so real Tab traversal cannot be simulated;
 * instead this audit verifies the invariants that make keyboard-only use
 * work: every interactive element is reachable (no `tabindex="-1"` on
 * actionable controls), none jumps the queue (no positive `tabindex`, so
 * focus order === logical DOM order), every control has an accessible name,
 * and the global `:focus-visible` styles exist.
 */

const FOCUSABLE_SELECTOR = 'button, a[href], input, select, textarea, [tabindex]';

function auditFocusables(container: HTMLElement, screenName: string): void {
  const focusables = [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
  expect(focusables.length, `${screenName} has interactive elements`).toBeGreaterThan(0);

  for (const element of focusables) {
    const tabIndex = element.getAttribute('tabindex');
    expect(
      tabIndex === null || Number(tabIndex) <= 0,
      `${screenName}: <${element.tagName.toLowerCase()}> must not use a positive tabindex`,
    ).toBe(true);

    const isHiddenFromTab = tabIndex === '-1' || (element as HTMLButtonElement).disabled === true;
    if (!isHiddenFromTab) {
      const name =
        element.getAttribute('aria-label') ??
        (element instanceof HTMLInputElement
          ? (element.labels?.[0]?.textContent ?? element.getAttribute('placeholder'))
          : element.textContent);
      expect(
        (name ?? '').trim().length,
        `${screenName}: focusable <${element.tagName.toLowerCase()}> needs an accessible name`,
      ).toBeGreaterThan(0);
    }
  }
}

beforeEach(() => {
  useLanguageStore.getState().setLanguage('en');
});

afterEach(() => {
  cleanup();
});

describe('keyboard navigation audit (010 T059)', () => {
  it('global :focus-visible styles are defined for interactive elements', () => {
    const css = readFileSync(join(__dirname, 'styles', 'globals.css'), 'utf8');
    expect(css).toMatch(/button:focus-visible/);
    expect(css).toMatch(/input:focus-visible/);
    expect(css).toMatch(/a:focus-visible/);
    expect(css).toMatch(/outline:\s*2px solid/);
  });

  it('WelcomePage controls are keyboard reachable in logical order', () => {
    const { container } = render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>,
    );
    auditFocusables(container, 'WelcomePage');
  });

  it('ImportPage (options + empty state) controls are keyboard reachable', () => {
    const { container } = render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/import',
            state: { chat: { id: 'c', displayName: 'L', phoneNumber: null } },
          },
        ]}
      >
        <Routes>
          <Route path="/import" element={<ImportPage />} />
        </Routes>
      </MemoryRouter>,
    );
    auditFocusables(container, 'ImportPage');

    cleanup();
    const empty = render(
      <MemoryRouter initialEntries={[{ pathname: '/import', state: null }]}>
        <Routes>
          <Route path="/import" element={<ImportPage />} />
        </Routes>
      </MemoryRouter>,
    );
    auditFocusables(empty.container, 'ImportPage (no chat)');
  });

  it('ExportCompletePage missing-result state is keyboard recoverable', () => {
    const { container } = render(
      <MemoryRouter initialEntries={[{ pathname: '/export/complete', state: null }]}>
        <Routes>
          <Route path="/export/complete" element={<ExportCompletePage />} />
        </Routes>
      </MemoryRouter>,
    );
    auditFocusables(container, 'ExportCompletePage');
  });

  it('shared Error/Empty state action buttons are keyboard reachable', () => {
    const { container } = render(
      <>
        <ErrorState
          title="Oops"
          retryLabel="Retry"
          onRetry={() => {}}
          backLabel="Back"
          onBack={() => {}}
        />
        <EmptyState title="Nothing here" actionLabel="Go" onAction={() => {}} />
      </>,
    );
    auditFocusables(container, 'shared states');
  });

  it('the wizard StepHeader exposes the progress position to screen readers', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/quality']}>
        <StepHeader />
      </MemoryRouter>,
    );
    const nav = container.querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toMatch(/Step 3 of 5/);
  });
});
