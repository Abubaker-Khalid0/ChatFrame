import type { ZodError } from 'zod';

/** A single field-level validation issue. */
export interface ValidationIssue {
  /** Dotted path to the failing field (e.g. `image.mediaId`), or `(root)`. */
  path: string;
  /** Human-readable reason the field failed. */
  message: string;
}

/** Structured validation error response body (FR-012). */
export interface ValidationErrorBody {
  error: 'VALIDATION_ERROR';
  message: string;
  issues: ValidationIssue[];
}

/** Flattens a `ZodError` into per-field path/message pairs. */
export function formatZodIssues(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : '(root)',
    message: issue.message,
  }));
}

/**
 * Builds a structured, human-readable validation error body from a `ZodError`,
 * identifying which field failed and why (FR-012, Constitution XIX).
 */
export function toValidationErrorBody(
  error: ZodError,
  message = 'Validation failed',
): ValidationErrorBody {
  return {
    error: 'VALIDATION_ERROR',
    message,
    issues: formatZodIssues(error),
  };
}
