import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WelcomeStage } from './dashboard/stages/WelcomeStage';
import { ImportConfigStage } from './dashboard/stages/ImportConfigStage';
import { ExportCompleteStage } from './dashboard/stages/ExportCompleteStage';
import { WorkflowRail } from './dashboard/WorkflowRail';
import { ErrorState } from './components/common/ErrorState';
import { EmptyState } from './components/common/EmptyState';
import { useLanguageStore } from './stores/useLanguageStore';
import { useWorkflowStore } from './stores/useWorkflowStore';

/**
 * Keyboard navigation audit (research §12), retargeted to the unified
 * dashboard. jsdom has no layout engine, so real Tab traversal cannot be
 * simulated; this audit verifies the invariants that make keyboard-only use
 * work: every interactive element is reachable (no positive tabindex, so focus
 * order === DOM order), every enabled control has an accessible name, and the
 * global `:focus-visible` styles exist.
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
  useWorkflowStore.getState().reset();
});

afterEach(() => {
  cleanup();
});

describe('keyboard navigation audit (dashboard)', () => {
  it('global :focus-visible styles are defined for interactive elements', () => {
    const css = readFileSync(join(__dirname, 'styles', 'globals.css'), 'utf8');
    expect(css).toMatch(/button:focus-visible/);
    expect(css).toMatch(/input:focus-visible/);
    expect(css).toMatch(/a:focus-visible/);
    expect(css).toMatch(/outline:\s*2px solid/);
  });

  it('WelcomeStage controls are keyboard reachable in logical order', () => {
    const { container } = render(<WelcomeStage />);
    auditFocusables(container, 'WelcomeStage');
  });

  it('ImportConfigStage (options + empty state) controls are keyboard reachable', () => {
    useWorkflowStore.setState({
      selectedChat: { id: 'c', displayName: 'L', phoneNumber: null },
      stage: 'import-config',
    });
    const { container } = render(<ImportConfigStage />);
    auditFocusables(container, 'ImportConfigStage');

    cleanup();
    useWorkflowStore.setState({ selectedChat: null });
    const empty = render(<ImportConfigStage />);
    auditFocusables(empty.container, 'ImportConfigStage (no chat)');
  });

  it('ExportCompleteStage missing-result state is keyboard recoverable', () => {
    useWorkflowStore.setState({ projectId: null, exportResult: null, stage: 'export-complete' });
    const { container } = render(<ExportCompleteStage />);
    auditFocusables(container, 'ExportCompleteStage');
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

  it('the workflow rail exposes the active step and a labeled nav to screen readers', () => {
    useWorkflowStore.setState({ projectId: 'p', stage: 'quality' });
    const { container } = render(<WorkflowRail />);
    const nav = container.querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toBe('Workflow');
    expect(container.querySelector('[aria-current="step"]')).not.toBeNull();
    auditFocusables(container, 'WorkflowRail');
  });
});
