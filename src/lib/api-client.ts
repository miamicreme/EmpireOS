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
    // A non-JSON response (e.g. an HTML 5xx/proxy error page) makes res.json()
    // throw; tolerate it and only trust a well-formed { ok } envelope. Anything
    // else surfaces as a clean error instead of being mis-cast as success.
    const json = (await res.json().catch(() => null)) as ApiResult<T> | null;
    if (json && typeof (json as { ok?: unknown }).ok === 'boolean') {
      return json;
    }
    const status = (res as { status?: number }).status;
    return {
      ok: false,
      error: { message: `Unexpected response from server${status ? ` (${status})` : ''}.` },
    };
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
