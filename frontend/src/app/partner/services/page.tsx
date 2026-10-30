'use client';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, put } from '@/lib/api';
import { loc, money, num } from '@/lib/format';
import type { Category, Service } from '@/lib/types';
import { useT } from '@/i18n';
import { toast, useUi } from '@/store/ui';
import { Async, Button, Card, Input, PageTitle, SectionTitle } from '@/components/ui';
import { usePartnerMe } from '@/features/partner/hooks';

export default function PartnerServices() {
  const t = useT();
  useUi((s) => s.lang);
  const qc = useQueryClient();
  const me = usePartnerMe();
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/categories') });
  const services = useQuery({ queryKey: ['services', 'all'], queryFn: () => api<Service[]>('/services') });
  const [sel, setSel] = useState<Record<string, string>>({}); // serviceId -> custom price ('' = base)
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!me.data) return;
    setSel(Object.fromEntries(me.data.services.map((s) => [s.serviceId, s.customPrice != null ? String(num(s.customPrice)) : ''])));
  }, [me.data]);

  async function save() {
    setBusy(true);
    try {
      await put('/partners/me/services', {
        services: Object.entries(sel).map(([serviceId, price]) => ({ serviceId, ...(price !== '' && { customPrice: Number(price) }) })),
      });
      toast.success(t('common.saved'));
      qc.invalidateQueries({ queryKey: ['partner-me'] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle>{t('partner.services')}</PageTitle>
      <Async q={services}>
        {(list) => (
          <>
            {(cats.data ?? [{ id: '_', name: { en: t('home.services') }, subCategories: [] } as unknown as Category]).map((c) => {
              const subIds = new Set(c.subCategories.map((s) => s.id));
              const items = cats.data ? list.filter((s) => subIds.has(s.subCategoryId)) : list;
              if (!items.length) return null;
              return (
                <section key={c.id}>
                  <SectionTitle>{loc(c.name)}</SectionTitle>
                  <ul className="space-y-2">
                    {items.map((s) => {
                      const on = s.id in sel;
                      return (
                        <li key={s.id}>
                          <Card className="py-3">
                            <label className="flex items-center gap-3">
                              <input type="checkbox" className="h-5 w-5 accent-orange-600" checked={on} onChange={(e) => setSel((x) => { const n = { ...x }; if (e.target.checked) n[s.id] = ''; else delete n[s.id]; return n; })} />
                              <span className="flex-1">
                                <span className="block font-medium">{loc(s.name)}</span>
                                <span className="text-xs text-gray-500">Base {money(s.basePrice)}</span>
                              </span>
                            </label>
                            {on && (
                              <div className="mt-2 flex items-center gap-2 pl-8">
                                <label htmlFor={`p-${s.id}`} className="text-sm text-gray-600">{t('partner.customPrice')}</label>
                                <Input id={`p-${s.id}`} className="max-w-32" inputMode="decimal" placeholder={String(num(s.basePrice))} value={sel[s.id]} onChange={(e) => setSel((x) => ({ ...x, [s.id]: e.target.value.replace(/[^\d.]/g, '') }))} />
                              </div>
                            )}
                          </Card>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
            <div className="sticky bottom-20 mt-4 md:bottom-4">
              <Button full loading={busy} onClick={save}>{t('common.save')} ({Object.keys(sel).length})</Button>
            </div>
          </>
        )}
      </Async>
    </>
  );
}
