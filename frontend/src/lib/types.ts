export type L10n = Record<string, string> | null | undefined;
export type Money = string | number;

export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'ASSIGNED'
  | 'PARTNER_EN_ROUTE'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED';
export type PaymentMethod = 'ONLINE' | 'UPI' | 'CASH' | 'WALLET';

export interface SubCategory { id: string; categoryId: string; slug: string; name: L10n }
export interface Category { id: string; slug: string; name: L10n; iconUrl?: string | null; subCategories: SubCategory[] }
export interface Service {
  id: string;
  subCategoryId: string;
  name: L10n;
  description?: L10n;
  basePrice: Money;
  durationMin: number;
  gstPct: number;
}
export interface Banner { id: string; title: string; imageUrl: string; link?: string | null }
export interface Recommendation { serviceId: string; name: string; score: number; reason: string }
export interface Town { id: string; name: string; state: string; lat: number; lng: number }
export interface Address {
  id: string;
  label: string;
  line1: string;
  line2?: string | null;
  city: string;
  pincode: string;
  lat: number;
  lng: number;
  isDefault: boolean;
}
export interface StatusLog { id: string; status: BookingStatus; at: string }
export interface Booking {
  id: string;
  code: string;
  status: BookingStatus;
  isInstant: boolean;
  scheduledAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelReason?: string | null;
  completionOtp?: string | null;
  basePrice: Money;
  surgeAmount: Money;
  discount: Money;
  taxAmount: Money;
  total: Money;
  paymentMethod: PaymentMethod;
  partnerId?: string | null;
  serviceId: string;
  addressId: string;
  service?: Service;
  address?: Address;
  statusLog?: StatusLog[];
  partner?: {
    id: string;
    lat?: number | null;
    lng?: number | null;
    ratingAvg?: number;
    user?: { name: string; phone?: string | null };
  } | null;
}
export interface Quote {
  basePrice: number;
  surgeAmount: number;
  discount: number;
  taxable: number;
  taxAmount: number;
  total: number;
}
export interface Paged<T> { items: T[]; total: number; page: number; limit: number }
export interface WalletTxn { id: string; type: 'CREDIT' | 'DEBIT'; amount: Money; reason: string; createdAt: string }
export interface Notification { id: string; title: string; body: string; readAt?: string | null; createdAt: string }
export interface Ticket {
  id: string;
  subject: string;
  body: string;
  status: string;
  isDispute: boolean;
  resolution?: string | null;
  createdAt: string;
  booking?: { id: string; code: string; status: string } | null;
}
export interface ChatMessage {
  id: string;
  bookingId: string;
  senderId: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
}
export interface Review {
  id: string;
  rating: number;
  comment?: string | null;
  reply?: string | null;
  createdAt: string;
  booking?: { customer?: { user?: { name: string } } };
}
export interface Coupon {
  code: string;
  type: 'PERCENT' | 'FLAT';
  value: Money;
  maxDiscount?: Money | null;
  minOrder?: Money | null;
  validTo: string;
}
export interface Profile {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  language: string;
  role: string;
  townId?: string | null;
  town?: { id: string; name: string; state: string } | null;
  referralCode: string;
  customer?: { loyaltyPoints: number; membershipId?: string | null; membershipEnds?: string | null } | null;
}
export interface Slot { id: string; weekday: number; startMin: number; endMin: number }
export interface Partner {
  id: string;
  kycStatus: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  isOnline: boolean;
  lat?: number | null;
  lng?: number | null;
  radiusKm: number;
  ratingAvg: number;
  ratingCount: number;
  completedJobs: number;
  acceptanceRate: number;
  bio?: string | null;
  user: { name: string; phone?: string | null; email?: string | null; avatarUrl?: string | null };
  documents: { id: string; type: string; verified: boolean; createdAt: string }[];
  services: { serviceId: string; customPrice?: Money | null; service: { id: string; name: L10n; basePrice: Money } }[];
  availability: Slot[];
}
export interface Payout {
  id: string;
  amount: Money;
  status: string;
  upiId?: string | null;
  bankAccount?: string | null;
  reference?: string | null;
  createdAt: string;
}
export interface Bucket { period: string; jobs: number; gross: number; commission: number; net: number }
