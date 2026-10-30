import { AppShell } from '@/components/AppShell';
import { PartnerTracker } from '@/features/partner/hooks';

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell variant="partner">
      <PartnerTracker />
      {children}
    </AppShell>
  );
}
