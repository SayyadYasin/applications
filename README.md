# TownServices

Local services marketplace for tier-2/3 towns (Urban Company-style).

| Folder | What | Stack |
|---|---|---|
| `backend/` | REST API + Socket.IO chat/tracking, Swagger at `/docs` | NestJS, Prisma, PostgreSQL |
| `frontend/` | Customer + partner PWA (en/hi/mr) | Next.js 15, Tailwind, Zustand |
| `admin/` | Admin panel | Vite, react-admin |
| `deploy/` | Production compose, Caddy TLS, deploy + backup scripts | Docker |

## Run locally
```bash
cp .env.example .env                  # set JWT_SECRET at minimum
docker compose up db -d
cd backend && npm install
npx prisma migrate deploy             # applies prisma/migrations (init included)
npm run seed                          # admin, towns, categories, services, coupons, demo partners/customer
npm run start:dev                     # API :4000, docs http://localhost:4000/docs
cd ../frontend && npm install && npm run dev    # :3000
cd ../admin && npm install && npm run dev       # :5173
```
Seeded logins (password `ChangeMe123!`, change in production): `admin@townservices.local`,
`partner1@townservices.local`, `customer@townservices.local`.
Or run everything: `docker compose up --build`.

## Features
- **Auth/RBAC:** email+password, phone OTP, Google OAuth, JWT; roles Customer / Partner / Admin / Super Admin.
- **Booking flow:** select service → slot (scheduled or instant) → payment (Razorpay/UPI, cash, wallet) → auto-assignment
  (proximity + rating + acceptance + availability calendar) → en-route → in-progress → completion by customer OTP → review → settlement.
- **Pricing:** peak-hour/weekend surge rules, coupons, membership discount, GST (CGST/SGST) invoices as PDF, per-partner commission.
- **Money:** wallet + top-up, refunds with cancellation policy, partner earnings, daily/weekly reports, payouts with admin approval, loyalty points, referral bonuses, memberships.
- **Engagement:** real-time chat and live partner tracking, notifications over in-app/email/SMS (MSG91)/WhatsApp/push (FCM), support tickets and disputes, favorites, reviews with partner replies.
- **Partner:** KYC with S3 document upload and admin review, services + custom prices, availability calendar, online toggle with location.
- **Admin:** dashboard, analytics, user/partner/booking/payment/refund/payout/coupon/plan/banner/CMS/town/pricing-rule management, broadcast center, CSV + GST reports, audit log.
- **AI recommendations:** deterministic scoring from history, local popularity, recency and seasonality (`backend/src/analytics`).
- **Multi-town / multi-language:** towns, town-scoped services and banners; names stored as `{en, hi, ...}` JSON.

## Deploy
CI (`.github/workflows/ci.yml`) tests and builds all apps, pushes images to GHCR and SSHes to the server.
Server setup: copy `deploy/` to `/opt/townservices`, create `.env.prod` from `.env.prod.example`, point `DOMAIN`,
`api.DOMAIN` and `admin.DOMAIN` DNS at the host, and set GitHub secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_KEY`
and variables `API_URL`, `GOOGLE_MAPS_KEY`, `GOOGLE_CLIENT_ID`. Add `deploy/backup-db.sh` to cron.
Set the Razorpay webhook to `POST {API_URL}/payments/webhook/razorpay`.

## Known limitations
- Needs real credentials (Razorpay, MSG91, SMTP, WhatsApp, Firebase, S3, Google, Maps) for those integrations; each degrades to a log/no-op or a clear error when unset.
- Notification fan-out beyond in-app isn't recorded in the DB; GST invoice assumes intra-state supply; `commission.default` setting isn't read by bookings yet (uses `DEFAULT_COMMISSION_PCT`).
- Verified: backend type-check, 69 unit tests, and full DI boot without a database. Not yet exercised against a live Postgres, real payment gateway or push/SMS providers.
