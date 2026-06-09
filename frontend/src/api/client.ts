/**
 * Minimal fetch client for the local backend. The base URL comes from the
 * environment (FR-009); only local communication is performed (FR-016).
 */
const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3714';

export async function getJson(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    throw new Error(`Request to ${path} failed with status ${res.status}`);
  }
  return res.json();
}
