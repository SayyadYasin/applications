'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, del, put } from '@/lib/api';
import type { Address } from '@/lib/types';
import { useT } from '@/i18n';
import { toast } from '@/store/ui';
import { Async, Badge, Button, Card, EmptyState, PageTitle, Sheet } from '@/components/ui';
import { AddressForm } from '@/features/address/AddressForm';

export default function AddressesPage() {
  const t = useT();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Address | 'new' | null>(null);
  const q = useQuery({ queryKey: ['addresses'], queryFn: () => api<Address[]>('/addresses') });
  const refresh = () => qc.invalidateQueries({ queryKey: ['addresses'] });

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <PageTitle action={<Button size="sm" onClick={() => setEditing('new')}>+ {t('common.add')}</Button>}>{t('profile.addresses')}</PageTitle>
      <Async q={q} empty={<EmptyState icon="📍" action={<Button onClick={() => setEditing('new')}>+ {t('book.addAddress')}</Button>} />}>
        {(list) => (
          <ul className="space-y-2">
            {list.map((a) => (
              <li key={a.id}>
                <Card>
                  <p className="font-semibold">{a.label} {a.isDefault && <Badge tone="orange">{t('profile.default')}</Badge>}</p>
                  <p className="text-sm text-gray-600">{[a.line1, a.line2, a.city, a.pincode].filter(Boolean).join(', ')}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(a)}>{t('common.edit')}</Button>
                    {!a.isDefault && <Button size="sm" variant="outline" onClick={() => act(() => put(`/addresses/${a.id}/default`))}>{t('profile.setDefault')}</Button>}
                    <Button size="sm" variant="ghost" onClick={() => act(() => del(`/addresses/${a.id}`))}>{t('common.delete')}</Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Async>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('book.addAddress') : t('common.edit')}>
        {editing && (
          <AddressForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? undefined : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => { setEditing(null); refresh(); }}
          />
        )}
      </Sheet>
    </>
  );
}
