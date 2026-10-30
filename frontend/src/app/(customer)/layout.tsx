import { AppShell } from '@/components/AppShell';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <AppShell variant="customer">{children}</AppShell>;
}
