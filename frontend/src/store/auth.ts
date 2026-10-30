import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SessionUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  language?: string;
  referralCode?: string;
}

interface AuthState {
  token: string | null;
  role: string | null;
  user: SessionUser | null;
  login: (token: string, role: string) => void;
  setUser: (u: SessionUser) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      user: null,
      login: (token, role) => set({ token, role }),
      setUser: (user) => set({ user, role: user.role }),
      logout: () => {
        // Drop cached per-user API responses held by the service worker.
        if (typeof navigator !== 'undefined') navigator.serviceWorker?.controller?.postMessage('clear-api');
        set({ token: null, role: null, user: null });
      },
    }),
    { name: 'ts-auth' },
  ),
);
