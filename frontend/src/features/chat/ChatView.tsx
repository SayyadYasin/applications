'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, post } from '@/lib/api';
import { emitMessage, emitRead, useBookingSocket } from '@/lib/socket';
import type { ChatMessage } from '@/lib/types';
import { dateTime } from '@/lib/format';
import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { toast } from '@/store/ui';
import { Button, Async, Input, cx, EmptyState } from '@/components/ui';

/** Booking chat over Socket.IO (/chat) with REST history and REST fallback for sending. */
export function ChatView({ bookingId }: { bookingId: string }) {
  const t = useT();
  const me = useAuth((s) => s.user?.id);
  const [live, setLive] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const history = useQuery({
    queryKey: ['messages', bookingId],
    queryFn: () => api<{ items: ChatMessage[]; nextCursor: string | null }>(`/bookings/${bookingId}/messages?limit=100`),
  });

  useBookingSocket(bookingId, {
    onMessage: (m) => {
      setLive((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]));
      if (m.senderId !== me) emitRead(bookingId);
    },
  });

  useEffect(() => {
    if (history.data) post(`/bookings/${bookingId}/messages/read`).catch(() => undefined);
  }, [history.data, bookingId]);

  const all = (() => {
    const map = new Map<string, ChatMessage>();
    for (const m of [...(history.data?.items ?? []), ...live]) map.set(m.id, m);
    return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  })();

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [all.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const r = await emitMessage(bookingId, body);
      if (r.error) {
        // Socket unavailable: fall back to REST (server persists; message arrives via history refresh).
        const m = await post<ChatMessage>(`/bookings/${bookingId}/messages`, { body });
        if (m?.id) setLive((l) => [...l, m]);
      }
      setText('');
    } catch (e2) {
      toast.error((e2 as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-11rem)] flex-col rounded-2xl border bg-white md:h-[70vh]">
      <div className="flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite">
        <Async q={history} isEmpty={() => false} empty={null}>
          {() =>
            all.length === 0 ? (
              <EmptyState icon="💬" />
            ) : (
              all.map((m) => {
                const mine = m.senderId === me;
                return (
                  <div key={m.id} className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
                    <div className={cx('max-w-[80%] rounded-2xl px-3 py-2 text-sm', mine ? 'rounded-br-sm bg-brand text-white' : 'rounded-bl-sm bg-gray-100')}>
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={cx('mt-1 text-[10px]', mine ? 'text-orange-100' : 'text-gray-500')}>
                        {dateTime(m.createdAt)} {mine && m.readAt ? '✓✓' : ''}
                      </p>
                    </div>
                  </div>
                );
              })
            )
          }
        </Async>
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t p-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Type a message" aria-label="Message" />
        <Button type="submit" loading={sending} disabled={!text.trim()}>{t('common.send')}</Button>
      </form>
    </div>
  );
}
