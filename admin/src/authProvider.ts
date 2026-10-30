import type { AuthProvider } from 'react-admin';
import { API_URL, ROLE_KEY, TOKEN_KEY, api, getToken } from './api';

const clear = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
};

export const authProvider: AuthProvider = {
  async login({ username, password }: { username: string; password: string }) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: username, password }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const m = body?.message;
      throw new Error(Array.isArray(m) ? m.join(', ') : m ?? 'Login failed');
    }
    if (body.role !== 'ADMIN' && body.role !== 'SUPER_ADMIN') {
      throw new Error('This account does not have admin access');
    }
    localStorage.setItem(TOKEN_KEY, body.accessToken);
    localStorage.setItem(ROLE_KEY, body.role);
  },
  async logout() {
    clear();
  },
  async checkAuth() {
    if (!getToken()) throw new Error('Not authenticated');
  },
  async checkError(error: { status?: number }) {
    // 401 means the token is invalid or expired. 403 only means the role lacks a permission, so stay logged in.
    if (error?.status === 401) {
      clear();
      throw new Error('Session expired');
    }
  },
  async getPermissions() {
    return localStorage.getItem(ROLE_KEY) ?? undefined;
  },
  async getIdentity() {
    const me = await api<{ id: string; name: string; email: string | null; role: string }>('auth/me');
    if (me.role !== 'ADMIN' && me.role !== 'SUPER_ADMIN') {
      clear();
      throw new Error('Not an admin');
    }
    localStorage.setItem(ROLE_KEY, me.role);
    return { id: me.id, fullName: `${me.name} (${me.role})` };
  },
};
