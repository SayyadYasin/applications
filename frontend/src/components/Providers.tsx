'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { useUi } from '@/store/ui';
import { Toaster } from './Toaster';

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } } }),
  );
  const lang = useUi((s) => s.lang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);

  return (
    <QueryClientProvider client={qc}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
