# Shipping Platform Requirements And Progress

Last updated: 2026-07-15

## Product Goal

Build a backend API for a shipping platform with two primary user roles:

- `SHIPPER`: creates quote requests, reviews broker offers, books an offer, tracks shipments, confirms delivery, and pays.
- `BROKER`: views available RFQs, submits offers, manages their offers, views shipments, and updates shipment status.

## Core Workflow Requirements

1. Shipper signs up/signs in with email/password or Google OAuth2.
2. Broker signs up/signs in with email/password or Google OAuth2.
3. Shipper creates an RFQ.
4. Shipper can view their own RFQs in "my RFQs".
5. Broker can view available RFQs.
6. Broker can submit one offer per RFQ.
7. Broker can view offers they made in their own RFQ/offer area.
8. Shipper can open an RFQ and see offers received for that RFQ.
9. Shipper books one offer.
10. Booking an offer creates a shipment from the RFQ and offer data.
11. Shipper and broker can view their shipments.
12. Broker updates shipment status.
13. Shipper confirms delivery.
14. Shipper is automatically given a pending payment option after delivery confirmation.
15. Shipper can view previous and ongoing payments.

## Technical Stack

- NestJS backend
- Prisma ORM
- PostgreSQL database
- Neon Postgres configured through `DATABASE_URL`
- JWT authentication
- Google OAuth2 sign-in
- Stored refresh tokens
- Bcrypt password hashing
- Stripe payment processing

## Implemented Database Models

Defined in `prisma/schema.prisma`:

- `User`
- `RefreshToken`
- `RFQ`
- `Offer`
- `Shipment`
- `Payment`

Defined enums:

- `UserRole`: `SHIPPER`, `BROKER`, `ADMIN`
- `RFQStatus`: `OPEN`, `BOOKED`, `CANCELLED`, `EXPIRED`
- `OfferStatus`: `PENDING`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`
- `ShipmentStatus`: `BOOKED`, `PICKED_UP`, `IN_TRANSIT`, `DELIVERED`, `DELIVERY_CONFIRMED`, `COMPLETED`, `CANCELLED`
- `PaymentStatus`: `PENDING`, `PROCESSING`, `PAID`, `FAILED`, `REFUNDED`

Applied migrations:

- `20260630165902_ffu`
- `20260630201546_add_core_shipping_models`
- `20260701092516_add_refresh_tokens`

## Implemented Backend Modules

### Prisma

Implemented:

- `PrismaModule`
- `PrismaService`
- Prisma 7 configured with `prisma-client-js`
- Postgres adapter usage through `@prisma/adapter-pg`

### Auth

Implemented:

- `AuthModule`
- `AuthController`
- `AuthService`
- `JwtStrategy`
- `JwtAuthGuard`
- `RolesGuard`
- `@Roles(...)`
- `@CurrentUser()`

Auth endpoints:

- `POST /auth/signup`
- `POST /auth/signin`
- `POST /auth/refresh`
- `POST /auth/signout`
- `GET /auth/me`

Auth behavior:

- Access tokens are JWTs.
- Refresh tokens are random opaque strings.
- Raw refresh tokens are returned to the client but not stored.
- Refresh token hashes are stored in the `refresh_tokens` table.
- Passwords are hashed with bcrypt.
- `@CurrentUser()` reads the authenticated user from `request.user`.
- Google OAuth2 sign-in should allow shippers and brokers to authenticate with Google.
- Google OAuth2 users should still receive the same app access token and refresh token response shape.
- Google OAuth2 account linking should prevent duplicate accounts for the same email/provider identity.

### RFQs

Implemented:

- `RfqsModule`
- `RfqsController`
- `RfqsService`
- RFQ create/update/list/detail/cancel DTOs

RFQ endpoints:

- `POST /rfqs`
- `GET /rfqs/my`
- `GET /rfqs/available`
- `GET /rfqs/:id`
- `PATCH /rfqs/:id`
- `PATCH /rfqs/:id/cancel`

RFQ behavior:

- Shipper creates RFQs.
- `shipperId` is derived from `@CurrentUser().sub`, not the request body.
- Shipper can list their own RFQs.
- Broker can list available RFQs.
- RFQs can be updated or cancelled only while `OPEN`.
- Ownership checks are performed in the service.

### Offers

Implemented:

- `OffersModule`
- `OffersController`
- `OffersService`
- Offer create/update DTOs

Offer endpoints:

- `POST /rfqs/:rfqId/offers`
- `GET /offers/my`
- `GET /rfqs/:rfqId/offers`
- `GET /offers/:id`
- `POST /offers/:id/book`
- `PATCH /offers/:id`
- `PATCH /offers/:id/withdraw`

Offer behavior:

- Broker creates offers on open RFQs.
- `brokerId` is derived from `@CurrentUser().sub`, not the request body.
- One broker can create one offer per RFQ.
- Broker can list their own offers.
- Shipper can view offers for their own RFQ.
- Broker can update or withdraw their own pending offer only while the RFQ is `OPEN`.
- Shipper can book one pending offer on their own open RFQ.
- Booking accepts the selected offer, rejects competing pending offers, marks the RFQ as `BOOKED`, and creates a shipment.

### Shipments

Implemented:

- `ShipmentsModule`
- `ShipmentsController`
- `ShipmentsService`
- Shipment status update DTO

Shipment endpoints:

- `GET /shipments/my`
- `GET /shipments/:id`
- `PATCH /shipments/:id/status`
- `POST /shipments/:id/confirm-delivery`

Shipment behavior:

- Shipper can list their own shipments.
- Broker can list their assigned shipments.
- Shipper, broker, and admin can view shipment detail when authorized.
- Broker can update their assigned shipment to `PICKED_UP`, `IN_TRANSIT`, `DELIVERED`, or `CANCELLED`.
- Broker setting a shipment to `DELIVERED` records `deliveredAt`.
- Shipper can confirm delivery only after broker marks the shipment as `DELIVERED`.
- Delivery confirmation sets status to `DELIVERY_CONFIRMED`, records `confirmedAt`, and creates a pending payment option.
- Terminal shipments cannot be updated by brokers.

### Payments

Implemented:

- `PaymentsModule`
- `PaymentsController`
- `PaymentsService`

Payment endpoints:

- `POST /shipments/:shipmentId/payments`
- `GET /payments/my`
- `GET /payments/:id`

Payment behavior:

- Shipper is given a pending payment after delivery confirmation.
- Payment amount and currency are copied from the shipment, not accepted from the request body.
- Payment creation requires the shipment to belong to the current shipper.
- Payment creation requires shipment status `DELIVERY_CONFIRMED`.
- One payment can exist per shipment.
- If a payment already exists for a shipment, the existing payment is returned.
- Stripe should be used to create checkout/payment sessions for pending payments.
- Stripe provider identifiers should be stored in `provider` and `providerRef`.
- Stripe webhook handling should update payment status to `PROCESSING`, `PAID`, `FAILED`, or `REFUNDED` based on provider events.
- Shipper can list their own payments.
- Shipper can view their own payment detail; admin can view any payment detail.

## Implemented Tooling And Scripts

Available npm scripts:

- `npm run build`
- `npm run start`
- `npm run start:dev`
- `npm run test`
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:studio`

Seed file:

- `prisma/seed.js`
- Currently seeds demo users only.
- It is standalone and not wired into `package.json`.

## Backend Work Status And Remaining Work

### Offer Booking

Implemented:

- Endpoint for shipper to accept/book an offer.
- Transaction to:
  - verify shipper owns the RFQ
  - verify RFQ is `OPEN`
  - verify offer belongs to RFQ
  - mark selected offer as `ACCEPTED`
  - mark other offers as `REJECTED`
  - update RFQ status to `BOOKED`
  - create shipment from RFQ and offer data

Endpoint:

- `POST /offers/:id/book`

### Shipments

Implemented:

- `ShipmentsModule`
- Shipper/broker shipment listing
- Shipment detail endpoint
- Broker shipment status update endpoint
- Shipper delivery confirmation endpoint

Endpoints:

- `GET /shipments/my`
- `GET /shipments/:id`
- `PATCH /shipments/:id/status`
- `POST /shipments/:id/confirm-delivery`

### Payments

Implemented:

- `PaymentsModule`
- Payment creation after delivery confirmation
- Payment history for shipper
- Payment detail endpoint

Endpoints:

- `POST /shipments/:shipmentId/payments`
- `GET /payments/my`
- `GET /payments/:id`

Still needed later:

- Stripe checkout/payment session creation
- Stripe webhook endpoint and signature verification
- Payment status updates from Stripe events

### Google OAuth2 Sign-In

Still needed:

- Google OAuth2 strategy/configuration.
- Auth endpoints for starting Google sign-in and handling the callback.
- User account lookup/linking by Google provider identity and verified email.
- JWT access token and stored refresh token issuance after successful Google sign-in.
- Environment variables for Google client ID, client secret, and callback URL.

### Stripe Payments

Still needed:

- Stripe SDK integration.
- Payment session creation for pending shipment payments.
- Stripe webhook endpoint with signature verification.
- Mapping Stripe events to internal `PaymentStatus`.
- Environment variables for Stripe secret key, webhook secret, and frontend success/cancel URLs.

### RFQ Detail With Offers

Discussed but not yet implemented:

- When shipper opens a specific RFQ, the RFQ detail response may include its offers directly.
- Current API already supports this through a separate endpoint: `GET /rfqs/:rfqId/offers`.
- Possible improvement: make `GET /rfqs/:id` include offers when the current user is the owning shipper.

## Current Access-Control Rules

- Authenticated user identity comes from the JWT access token.
- Feature ownership fields are not accepted from request bodies.
- `shipperId` and `brokerId` are derived from `@CurrentUser().sub`.
- Missing or invalid access token should return `401`.
- Valid token with wrong role should return `403`.
- Hidden or unauthorized records generally return `404`.

## Verification Already Performed

Previously verified successfully:

- Prisma client generation
- Prisma migrations against Neon
- Nest build
- Existing Jest test suite

Commands used during development included:

- `npm.cmd run prisma:generate`
- `npm.cmd run prisma:migrate -- --name add-core-shipping-models`
- `npm.cmd run prisma:migrate -- --name add-refresh-tokens`
- `npm.cmd run build`
- `npm.cmd test`

## Known Notes

- The repository is still mostly untracked from Git's perspective in the current workspace.
- A Git safe-directory warning appeared under the sandbox user when running `git status`.
- The default `AppController` and `AppService` still exist.
- No dedicated `UsersModule` exists; auth uses Prisma user queries directly.
- Unit tests now cover offer booking and shipment service behavior; Auth, RFQs, and broader integration flows still need dedicated tests.
