import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Stripe from 'stripe';

type CreateCheckoutSessionInput = {
  paymentId: string;
  shipmentId: string;
  shipperId: string;
  brokerId: string;
  brokerStripeAccountId: string;
  amount: Prisma.Decimal;
  currency: string;
  platformFeeAmount: Prisma.Decimal;
  description: string;
};

@Injectable()
export class StripeService {
  private stripe?: Stripe;

  async createCheckoutSession(input: CreateCheckoutSessionInput) {
    const amountInMinorUnits = this.toMinorUnits(input.amount);
    const platformFeeInMinorUnits = this.toMinorUnits(input.platformFeeAmount);

    return this.client().checkout.sessions.create({
      mode: 'payment',
      success_url: this.requiredEnv('STRIPE_SUCCESS_URL'),
      cancel_url: this.requiredEnv('STRIPE_CANCEL_URL'),
      client_reference_id: input.paymentId,
      metadata: {
        paymentId: input.paymentId,
        shipmentId: input.shipmentId,
        shipperId: input.shipperId,
        brokerId: input.brokerId,
      },
      payment_intent_data: {
        application_fee_amount: platformFeeInMinorUnits,
        transfer_data: {
          destination: input.brokerStripeAccountId,
        },
        metadata: {
          paymentId: input.paymentId,
          shipmentId: input.shipmentId,
          shipperId: input.shipperId,
          brokerId: input.brokerId,
        },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: amountInMinorUnits,
            product_data: {
              name: 'Shipment payment',
              description: input.description,
            },
          },
        },
      ],
    });
  }

  retrieveCheckoutSession(sessionId: string) {
    return this.client().checkout.sessions.retrieve(sessionId);
  }

  constructWebhookEvent(rawBody: Buffer, signature: string) {
    try {
      return this.client().webhooks.constructEvent(
        rawBody,
        signature,
        this.requiredEnv('STRIPE_WEBHOOK_SECRET'),
      );
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }
  }

  private toMinorUnits(amount: Prisma.Decimal) {
    return Math.round(amount.toNumber() * 100);
  }

  private client() {
    if (!this.stripe) {
      this.stripe = new Stripe(this.requiredEnv('STRIPE_SECRET_KEY'));
    }

    return this.stripe;
  }

  private requiredEnv(name: string) {
    const value = process.env[name];

    if (!value) {
      throw new Error(`${name} is not set`);
    }

    return value;
  }
}
