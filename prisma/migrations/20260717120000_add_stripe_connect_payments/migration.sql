-- Add broker Stripe Connect account storage.
ALTER TABLE "users" ADD COLUMN "stripeAccountId" TEXT;

CREATE UNIQUE INDEX "users_stripeAccountId_key" ON "users"("stripeAccountId");

-- Add Stripe marketplace accounting and provider identifiers.
ALTER TABLE "payments" ADD COLUMN "grossAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "payments" ADD COLUMN "platformFeeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "payments" ADD COLUMN "brokerAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "payments" ADD COLUMN "stripeCheckoutSessionId" TEXT;
ALTER TABLE "payments" ADD COLUMN "stripePaymentIntentId" TEXT;
ALTER TABLE "payments" ADD COLUMN "stripeTransferDestination" TEXT;

-- Backfill gross amounts for any existing payments.
UPDATE "payments"
SET "grossAmount" = "amount"
WHERE "grossAmount" = 0;
