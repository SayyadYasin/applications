import { HttpError } from 'react-admin';

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
export const DOCS_BASE_URL = import.meta.env.VITE_DOCS_BASE_URL ?? '';
export const TOKEN_KEY = 'ts_admin_token';
export const ROLE_KEY = 'ts_admin_role';

export type AdminRole = 'ADMIN' | 'SUPER_ADMIN';

export const getToken = () => localStorage.getItem(TOKEN_KEY);

type Query = Record<string, unknown>;

function buildUrl(path: string, query?: Query) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null || v === '') continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return `${API_URL}/${path.replace(/^\//, '')}${s ? `?${s}` : ''}`;
}

function authHeaders(json = false): Record<string, string> {
  const h: Record<string, string> = {};
  const t = getToken();
  if (t) h.Authorization = `Bearer ${t}`;
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

async function toError(res: Response): Promise<HttpError> {
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-json */
  }
  const m = body?.message;
  const message = Array.isArray(m) ? m.join(', ') : typeof m === 'string' ? m : res.statusText || `HTTP ${res.status}`;
  return new HttpError(message, res.status, body);
}

export async function api<T = any>(
  path: string,
  opts: { method?: string; query?: Query; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(buildUrl(path, opts.query), {
    method: opts.method ?? 'GET',
    headers: authHeaders(opts.body !== undefined),
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw await toError(res);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Fetches a CSV (or any file) with the bearer token and triggers a browser download. */
export async function downloadFile(path: string, query: Query, filename: string) {
  const res = await fetch(buildUrl(path, query), { headers: authHeaders() });
  if (!res.ok) throw await toError(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
