/**
 * Minimal fetch client for the local backend. The base URL comes from the
 * environment (FR-009); only local communication is performed (FR-016).
 */
const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3714';

/** Builds an absolute backend URL (e.g. for `<img src>` media streaming). */
export function apiUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

/**
 * Error for non-2xx responses, carrying the HTTP status and the backend's
 * machine-readable `error` code (e.g. `SESSION_NOT_CONNECTED`) so callers can
 * branch on the failure kind (FR-006, Constitution XIX).
 */
export class ApiError extends Error {
  constructor(
    path: string,
    public readonly status: number,
    public readonly code: string | null,
  ) {
    super(`Request to ${path} failed with status ${status}`);
    this.name = 'ApiError';
  }
}

/** Builds an {@link ApiError}, extracting the structured code when present. */
async function toApiError(path: string, res: Response): Promise<ApiError> {
  let code: string | null = null;
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === 'string') {
      code = body.error;
    }
  } catch {
    // A non-JSON error body still yields a usable status-only error.
  }
  return new ApiError(path, res.status, code);
}

export async function getJson(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    throw await toApiError(path, res);
  }
  return res.json();
}

export async function postJson(path: string, body: unknown, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Request to ${path} failed with status ${res.status}`);
  }
  return res.json();
}

export async function patchJson(path: string, body: unknown, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Request to ${path} failed with status ${res.status}`);
  }
  return res.json();
}
