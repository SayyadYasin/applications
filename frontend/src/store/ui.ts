import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Lang = 'en' | 'hi' | 'mr';
export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}

interface UiState {
  lang: Lang;
  setLang: (l: Lang) => void;
  toasts: Toast[];
  push: (kind: Toast['kind'], text: string) => void;
  dismiss: (id: number) => void;
}

let seq = 0;
export const useUi = create<UiState>()(
  persist(
    (set, get) => ({
      lang: 'en',
      setLang: (lang) => set({ lang }),
      toasts: [],
      push: (kind, text) => {
        const id = ++seq;
        set({ toasts: [...get().toasts, { id, kind, text }] });
        setTimeout(() => get().dismiss(id), 4500);
      },
      dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
    }),
    { name: 'ts-ui', partialize: (s) => ({ lang: s.lang }) },
  ),
);

export const toast = {
  success: (t: string) => useUi.getState().push('success', t),
  error: (t: string) => useUi.getState().push('error', t),
  info: (t: string) => useUi.getState().push('info', t),
};
