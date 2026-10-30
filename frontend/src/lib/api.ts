import { useAuth } from '@/store/auth';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function headers(init: RequestInit, json: boolean): HeadersInit {
  const token = useAuth.getState().token;
  return {
    ...(json && { 'Content-Type': 'application/json' }),
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(init.headers as Record<string, string> | undefined),
  };
}

async function fail(res: Response): Promise<never> {
  if (res.status === 401) useAuth.getState().logout();
  const body = await res.json().catch(() => ({}));
  const m = body?.message;
  throw new ApiError(Array.isArray(m) ? m.join(', ') : (m ?? res.statusText), res.status);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: headers(init, init.body !== undefined && !(init.body instanceof FormData)),
  });
  if (!res.ok) return fail(res);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

const body = (b: unknown) => (b === undefined ? undefined : JSON.stringify(b));
export const post = <T>(path: string, b?: unknown) => api<T>(path, { method: 'POST', body: body(b) });
export const put = <T>(path: string, b?: unknown) => api<T>(path, { method: 'PUT', body: body(b) });
export const patch = <T>(path: string, b?: unknown) => api<T>(path, { method: 'PATCH', body: body(b) });
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });

export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Download an authenticated binary (e.g. invoice PDF) and trigger a browser save. */
export async function download(path: string, filename: string) {
  const res = await fetch(`${API_BASE}${path}`, { headers: headers({}, false) });
  if (!res.ok) return fail(res);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Upload a file straight to S3 using a presigned URL returned by the API. */
export async function uploadPresigned(
  presign: { uploadUrl: string; headers?: Record<string, string>; key: string },
  file: File,
) {
  const res = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: presign.headers ?? { 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) throw new ApiError('Upload failed', res.status);
  return presign.key;
}
