/**
 * Typed storage error classes (Constitution XIX — explicit error handling).
 *
 * Each error carries a machine-readable `code` so the API layer can map it to a
 * structured response (`{ error, message, details }`). Messages are kept
 * redaction-safe: they NEVER include QR codes, tokens, secrets, or message
 * content (FR-016).
 */

/** A single field-level validation issue, mirroring the API error shape. */
export interface FieldIssue {
  /** Dotted path to the failing field (e.g. `status`), or `(root)`. */
  path: string;
  /** Human-readable reason the field failed. */
  message: string;
}

/**
 * Base class for all storage-layer failures. Carries a machine-readable code
 * the API layer maps onto an error response body.
 */
export class StorageError extends Error {
  readonly code: string;

  constructor(message: string, code = 'STORAGE_ERROR') {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    // Restore the prototype chain for instanceof checks under transpilation.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Raised when no project folder exists for the requested ID. */
export class ProjectNotFoundError extends StorageError {
  /** The project ID (folder name) that was not found. */
  readonly projectId: string;

  constructor(projectId: string) {
    super(`Project '${projectId}' not found`, 'PROJECT_NOT_FOUND');
    this.name = 'ProjectNotFoundError';
    this.projectId = projectId;
  }
}

/**
 * Raised when a JSON file (e.g. `project.json`) exists but fails schema
 * validation — for instance after a manual edit. Carries per-field issues for
 * the API layer to surface as `details`.
 */
export class ManifestValidationError extends StorageError {
  /** Per-field validation issues (path + message). */
  readonly details: FieldIssue[];

  constructor(message: string, details: FieldIssue[]) {
    super(message, 'MANIFEST_VALIDATION_ERROR');
    this.name = 'ManifestValidationError';
    this.details = details;
  }
}

/**
 * Raised when export generation fails (filesystem write, template rendering,
 * asset copy). The API layer maps it to `500 EXPORT_ERROR` with a user-safe
 * message (data-model 010 §1.2/§1.3).
 */
export class ExportError extends Error {
  readonly code: string;

  constructor(message: string, code = 'EXPORT_ERROR') {
    super(message);
    this.name = 'ExportError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Raised when an individual image download fails during import. Non-fatal by
 * design — the pipeline records a placeholder and continues (data-model 010
 * §1.2). Only mapped to an HTTP response if it unexpectedly escapes.
 */
export class MediaDownloadError extends Error {
  readonly code: string;
  /** The media reference that failed to download (never message content). */
  readonly mediaId?: string;

  constructor(message: string, mediaId?: string, code = 'MEDIA_DOWNLOAD_ERROR') {
    super(message);
    this.name = 'MediaDownloadError';
    this.code = code;
    if (mediaId !== undefined) {
      this.mediaId = mediaId;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Raised when the normalization pipeline fails fatally. Raw data is always
 * preserved (Constitution VI); the API layer maps it to
 * `500 NORMALIZATION_ERROR` (data-model 010 §1.2/§1.3).
 */
export class NormalizationError extends Error {
  readonly code: string;

  constructor(message: string, code = 'NORMALIZATION_ERROR') {
    super(message);
    this.name = 'NormalizationError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
