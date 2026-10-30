'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { useT } from '@/i18n';
import { toast } from '@/store/ui';
import { Async, Button, Card, Row, SectionTitle } from '@/components/ui';

interface Stats { referralCode: string; referredCount: number; rewardedCount: number; totalEarned: string; bonusPerReferral: number }

export function ReferralCard() {
  const t = useT();
  const q = useQuery({ queryKey: ['referral'], queryFn: () => api<Stats>('/referrals/me') });

  async function share(code: string) {
    const text = t('referral.shareText', { code });
    const url = `${window.location.origin}/register?ref=${encodeURIComponent(code)}`;
    try {
      if (navigator.share) await navigator.share({ title: t('appName'), text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast.success(t('common.copied'));
      }
    } catch {
      /* user dismissed share sheet */
    }
  }

  return (
    <>
      <SectionTitle>{t('referral.title')}</SectionTitle>
      <Async q={q}>
        {(s) => (
          <Card>
            <p className="text-sm text-gray-600">{t('referral.code')}</p>
            <p className="my-1 font-mono text-2xl font-extrabold tracking-wider text-brand">{s.referralCode}</p>
            <Row label={t('referral.invited')} value={s.referredCount} />
            <Row label={t('referral.earned')} value={money(s.totalEarned)} />
            <Button full className="mt-3" onClick={() => share(s.referralCode)}>🔗 {t('common.share')} (+{money(s.bonusPerReferral)})</Button>
          </Card>
        )}
      </Async>
    </>
  );
}
