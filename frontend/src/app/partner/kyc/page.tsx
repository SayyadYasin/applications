'use client';
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { post, uploadPresigned } from '@/lib/api';
import { dateOnly } from '@/lib/format';
import { useT } from '@/i18n';
import { toast } from '@/store/ui';
import { Async, Badge, Button, Card, PageTitle, statusTone } from '@/components/ui';
import { usePartnerMe } from '@/features/partner/hooks';

const TYPES = [
  { type: 'AADHAAR', label: 'Aadhaar card' },
  { type: 'PAN', label: 'PAN card' },
  { type: 'LICENSE', label: 'Trade licence / ID proof' },
  { type: 'SELFIE', label: 'Selfie' },
] as const;

export default function KycPage() {
  const t = useT();
  const qc = useQueryClient();
  const me = usePartnerMe();
  const [uploading, setUploading] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function upload(type: string, file: File) {
    if (file.size > 10 * 1024 * 1024) return toast.error('File must be under 10 MB');
    setUploading(type);
    try {
      const contentType = file.type || 'application/octet-stream';
      const presign = await post<{ uploadUrl: string; key: string; headers?: Record<string, string> }>('/partners/me/kyc/upload-url', { type, contentType });
      await uploadPresigned(presign, file);
      await post('/partners/me/kyc/documents', { type, key: presign.key });
      toast.success(`${type} uploaded`);
      qc.invalidateQueries({ queryKey: ['partner-me'] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading('');
      const el = inputs.current[type];
      if (el) el.value = '';
    }
  }

  async function submit() {
    setSubmitting(true);
    try {
      await post('/partners/me/kyc/submit');
      toast.success('KYC submitted for review');
      qc.invalidateQueries({ queryKey: ['partner-me'] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageTitle>{t('partner.kyc')}</PageTitle>
      <Async q={me}>
        {(p) => (
          <>
            <Card className="mb-3 flex items-center justify-between">
              <span className="font-medium">{t('partner.kycStatus')}</span>
              <Badge tone={statusTone(p.kycStatus)}>{p.kycStatus}</Badge>
            </Card>
            <h2 className="mb-2 font-semibold">{t('partner.docs')}</h2>
            <ul className="space-y-2">
              {TYPES.map(({ type, label }) => {
                const docs = p.documents.filter((d) => d.type === type);
                const locked = p.kycStatus === 'APPROVED';
                return (
                  <li key={type}>
                    <Card>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{label}</p>
                          {docs.map((d) => (
                            <p key={d.id} className="text-xs text-gray-500">
                              {dateOnly(d.createdAt)} · {d.verified ? <span className="text-green-700">Verified</span> : 'Pending review'}
                            </p>
                          ))}
                        </div>
                        {!locked && (
                          <>
                            <input
                              ref={(el) => { inputs.current[type] = el; }}
                              id={`f-${type}`}
                              type="file"
                              accept="image/jpeg,image/png,image/webp,application/pdf"
                              capture={type === 'SELFIE' ? 'user' : undefined}
                              className="sr-only"
                              onChange={(e) => e.target.files?.[0] && upload(type, e.target.files[0])}
                            />
                            <Button size="sm" variant="outline" loading={uploading === type} onClick={() => inputs.current[type]?.click()}>
                              {docs.length ? 'Replace' : t('partner.upload')}
                            </Button>
                          </>
                        )}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
            {p.kycStatus !== 'APPROVED' && p.kycStatus !== 'SUBMITTED' && (
              <Button full className="mt-4" loading={submitting} disabled={p.documents.length === 0} onClick={submit}>{t('partner.submitKyc')}</Button>
            )}
            {p.kycStatus === 'SUBMITTED' && <p className="mt-3 text-center text-sm text-gray-600">Your documents are under review.</p>}
          </>
        )}
      </Async>
    </>
  );
}
