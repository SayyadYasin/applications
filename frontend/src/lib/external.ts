/* Lazy loaders for third-party browser SDKs (Google Maps, Razorpay, Google Identity Services). */

const loading = new Map<string, Promise<void>>();

export function loadScript(src: string): Promise<void> {
  const existing = loading.get(src);
  if (existing) return existing;
  const p = new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') return reject(new Error('no document'));
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading.delete(src);
      reject(new Error(`Failed to load ${src}`));
    };
    document.head.appendChild(s);
  });
  loading.set(src, p);
  return p;
}

// ---------- Google Maps ----------
export const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GMaps = any;

/** Resolves to `google.maps` or null when no key is configured / the script fails to load. */
export async function loadMaps(): Promise<GMaps | null> {
  if (!MAPS_KEY) return null;
  try {
    await loadScript(`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_KEY)}&v=weekly`);
    return (window as unknown as { google?: { maps?: GMaps } }).google?.maps ?? null;
  } catch {
    return null;
  }
}

export const directionsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

// ---------- Razorpay ----------
export interface RazorpayOrder {
  orderId: string;
  keyId: string;
  amount: number | string;
  currency?: string;
}
interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/** Opens Razorpay Checkout; resolves with the payment response or rejects when dismissed/failed. */
export async function openRazorpay(
  order: RazorpayOrder,
  opts: { name: string; description: string; prefill?: { name?: string; email?: string; contact?: string }; upi?: boolean },
): Promise<RazorpaySuccess> {
  await loadScript('https://checkout.razorpay.com/v1/checkout.js');
  const Razorpay = (window as unknown as { Razorpay?: new (o: unknown) => { open(): void; on(e: string, cb: (r: unknown) => void): void } }).Razorpay;
  if (!Razorpay) throw new Error('Razorpay is unavailable');
  return new Promise((resolve, reject) => {
    const rzp = new Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency ?? 'INR',
      order_id: order.orderId,
      name: opts.name,
      description: opts.description,
      theme: { color: '#ea580c' },
      prefill: { ...opts.prefill, ...(opts.upi && { method: 'upi' }) },
      handler: (r: RazorpaySuccess) => resolve(r),
      modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
    });
    rzp.on('payment.failed', () => reject(new Error('Payment failed')));
    rzp.open();
  });
}

// ---------- Google Identity Services ----------
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

interface GisApi {
  accounts: {
    id: {
      initialize(o: { client_id: string; callback: (r: { credential: string }) => void }): void;
      renderButton(el: HTMLElement, o: Record<string, unknown>): void;
    };
  };
}

export async function renderGoogleButton(el: HTMLElement, onToken: (idToken: string) => void) {
  if (!GOOGLE_CLIENT_ID) return false;
  await loadScript('https://accounts.google.com/gsi/client');
  const g = (window as unknown as { google?: GisApi }).google;
  if (!g) return false;
  g.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r) => onToken(r.credential) });
  g.accounts.id.renderButton(el, { theme: 'outline', size: 'large', width: Math.min(360, el.clientWidth || 320), text: 'continue_with' });
  return true;
}

// ---------- Geolocation ----------
export function getPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new Error(e.message || 'Could not get location')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  });
}
