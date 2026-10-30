'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useT } from '@/i18n';
import { PageTitle } from '@/components/ui';
import { ChatView } from '@/features/chat/ChatView';

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  return (
    <>
      <PageTitle action={<Link href={`/bookings/${id}`} className="text-sm text-brand">← {t('common.back')}</Link>}>{t('bookings.chat')}</PageTitle>
      <ChatView bookingId={id} />
    </>
  );
}
