/**
 * Placeholder shared types. Real domain types (messages, projects, render
 * model, etc.) are introduced in later phases. This file establishes the
 * `types` barrel so consumers have a stable import location.
 */

/** Nominal typing helper for future branded IDs (e.g. `Brand<string, 'ProjectId'>`). */
export type Brand<T, B extends string> = T & { readonly __brand: B };

export * from './session';
