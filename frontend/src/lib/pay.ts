import { post } from './api';
import { openRazorpay, type RazorpayOrder } from './external';
import type { Booking } from './types';
import { useAuth } from '@/store/auth';

/** Takes payment for a PENDING_PAYMENT booking according to its method. Cash needs no action. */
export async function payForBooking(b: Pick<Booking, 'id' | 'code' | 'paymentMethod'>) {
  if (b.paymentMethod === 'WALLET') {
    await post(`/wallet/pay-booking/${b.id}`);
    return;
  }
  if (b.paymentMethod === 'ONLINE' || b.paymentMethod === 'UPI') {
    const order = await post<RazorpayOrder>(`/payments/order/${b.id}`);
    const u = useAuth.getState().user;
    await openRazorpay(order, {
      name: 'TownServices',
      description: `Booking ${b.code}`,
      upi: b.paymentMethod === 'UPI',
      prefill: { name: u?.name, email: u?.email ?? undefined, contact: u?.phone ?? undefined },
    });
    // Confirmation arrives via the Razorpay webhook; the booking page polls until it is confirmed.
  }
}
