/**
 * Browser-side typed fetch wrapper. Mirrors the server { ok, data } | { ok, error }
 * envelope so client components get a discriminated result without try/catch noise.
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code?: string; message: string } };

async function request<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    const json = (await res.json()) as ApiResult<T>;
    return json;
  } catch {
    return { ok: false, error: { message: 'Network error' } };
  }
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body: unknown) =>
    request<T>(url, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(url: string, body: unknown) =>
    request<T>(url, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
};

/** Format a number as USD with no cents. */
export function usd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
