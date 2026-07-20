import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Payment,
  PaymentStatus,
  Prisma,
  ShipmentStatus,
  UserRole,
} from '@prisma/client';
import Stripe from 'stripe';
import type { AuthUser } from '../auth/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  async create(user: AuthUser, shipmentId: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        broker: {
          select: { stripeAccountId: true },
        },
        payment: {
          select: { id: true },
        },
      },
    });

    if (!shipment || shipment.shipperId !== user.sub) {
      throw new NotFoundException('Shipment not found');
    }

    if (shipment.status !== ShipmentStatus.DELIVERY_CONFIRMED) {
      throw new BadRequestException(
        'Payment can only be created after delivery confirmation',
      );
    }

    const grossAmount = shipment.price;
    const platformFeeAmount = this.calculatePlatformFee(grossAmount);
    const brokerAmount = grossAmount.minus(platformFeeAmount);

    if (shipment.payment) {
      return this.prisma.payment.update({
        where: { id: shipment.payment.id },
        data: {
          amount: grossAmount,
          grossAmount,
          platformFeeAmount,
          brokerAmount,
          stripeTransferDestination: shipment.broker.stripeAccountId,
        },
        include: this.defaultInclude(),
      });
    }

    return this.prisma.payment.create({
      data: {
        shipmentId: shipment.id,
        shipperId: shipment.shipperId,
        amount: grossAmount,
        grossAmount,
        platformFeeAmount,
        brokerAmount,
        currency: shipment.currency,
        status: PaymentStatus.PENDING,
        provider: null,
        providerRef: null,
        stripeCheckoutSessionId: null,
        stripePaymentIntentId: null,
        stripeTransferDestination: shipment.broker.stripeAccountId,
        paidAt: null,
      },
      include: this.defaultInclude(),
    });
  }

  async createCheckoutSession(user: AuthUser, id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        shipment: {
          include: {
            broker: {
              select: {
                id: true,
                stripeAccountId: true,
              },
            },
          },
        },
      },
    });

    if (!payment || !this.canView(user, payment)) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Only pending payments can be checked out');
    }

    if (payment.shipment.status !== ShipmentStatus.DELIVERY_CONFIRMED) {
      throw new BadRequestException(
        'Payment can only be checked out after delivery confirmation',
      );
    }

    if (!payment.shipment.broker.stripeAccountId) {
      throw new BadRequestException(
        'Broker does not have a Stripe connected account',
      );
    }

    const reusableCheckoutUrl = await this.findReusableCheckoutUrl(payment);

    if (reusableCheckoutUrl) {
      return { ...payment, checkoutUrl: reusableCheckoutUrl };
    }

    const grossAmount = payment.amount;
    const platformFeeAmount = this.calculatePlatformFee(grossAmount);
    const brokerAmount = grossAmount.minus(platformFeeAmount);

    const checkoutSession = await this.stripeService.createCheckoutSession({
      paymentId: payment.id,
      shipmentId: payment.shipmentId,
      shipperId: payment.shipperId,
      brokerId: payment.shipment.brokerId,
      brokerStripeAccountId: payment.shipment.broker.stripeAccountId,
      amount: grossAmount,
      currency: payment.currency,
      platformFeeAmount,
      description: `${payment.shipment.origin} to ${payment.shipment.destination}`,
    });

    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        amount: grossAmount,
        grossAmount,
        platformFeeAmount,
        brokerAmount,
        provider: 'stripe',
        providerRef: checkoutSession.id,
        stripeCheckoutSessionId: checkoutSession.id,
        stripePaymentIntentId: this.toStringId(checkoutSession.payment_intent),
        stripeTransferDestination: payment.shipment.broker.stripeAccountId,
      },
      include: this.defaultInclude(),
    });

    return { ...updatedPayment, checkoutUrl: checkoutSession.url };
  }

  findMine(user: AuthUser) {
    return this.prisma.payment.findMany({
      where: { shipperId: user.sub },
      orderBy: { createdAt: 'desc' },
      include: this.defaultInclude(),
    });
  }

  async findOne(user: AuthUser, id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: this.defaultInclude(),
    });

    if (!payment || !this.canView(user, payment)) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  handleStripeWebhook(rawBody: Buffer, signature: string) {
    const event = this.stripeService.constructWebhookEvent(rawBody, signature);

    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        return this.markCheckoutSessionPaid(event.data.object);
      case 'checkout.session.async_payment_failed':
        return this.markCheckoutSessionFailed(event.data.object);
      case 'charge.refunded':
        return this.markPaymentIntentRefunded(event.data.object.payment_intent);
      case 'charge.refund.updated':
        return this.markPaymentIntentRefunded(event.data.object.payment_intent);
      default:
        return { received: true };
    }
  }

  private canView(user: AuthUser, payment: Payment) {
    if (user.role === UserRole.SHIPPER) {
      return payment.shipperId === user.sub;
    }

    return user.role === UserRole.ADMIN;
  }

  private async findReusableCheckoutUrl(payment: Payment) {
    if (
      payment.status !== PaymentStatus.PENDING ||
      !payment.stripeCheckoutSessionId
    ) {
      return null;
    }

    try {
      const session = await this.stripeService.retrieveCheckoutSession(
        payment.stripeCheckoutSessionId,
      );

      return session.url;
    } catch {
      return null;
    }
  }

  private calculatePlatformFee(amount: Prisma.Decimal) {
    const feePercent = new Prisma.Decimal(
      process.env.PLATFORM_FEE_PERCENT ?? '10',
    );

    return amount.mul(feePercent).div(100).toDecimalPlaces(2);
  }

  private async markCheckoutSessionPaid(session: Stripe.Checkout.Session) {
    const payment = await this.findPaymentForCheckoutSession(session);

    if (!payment) {
      return { received: true };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PAID,
          provider: 'stripe',
          providerRef: session.id,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: this.toStringId(session.payment_intent),
          paidAt: new Date(),
        },
      });

      await tx.shipment.update({
        where: { id: payment.shipmentId },
        data: { status: ShipmentStatus.COMPLETED },
      });
    });

    return { received: true };
  }

  private async markCheckoutSessionFailed(session: Stripe.Checkout.Session) {
    const payment = await this.findPaymentForCheckoutSession(session);

    if (!payment) {
      return { received: true };
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        provider: 'stripe',
        providerRef: session.id,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: this.toStringId(session.payment_intent),
      },
    });

    return { received: true };
  }

  private async markPaymentIntentRefunded(
    paymentIntent: string | Stripe.PaymentIntent | null,
  ) {
    const paymentIntentId = this.toStringId(paymentIntent);

    if (!paymentIntentId) {
      return { received: true };
    }

    await this.prisma.payment.updateMany({
      where: { stripePaymentIntentId: paymentIntentId },
      data: { status: PaymentStatus.REFUNDED },
    });

    return { received: true };
  }

  private async findPaymentForCheckoutSession(session: Stripe.Checkout.Session) {
    const paymentId = session.metadata?.paymentId ?? session.client_reference_id;

    if (paymentId) {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
      });

      if (payment) {
        return payment;
      }
    }

    return this.prisma.payment.findFirst({
      where: { stripeCheckoutSessionId: session.id },
    });
  }

  private toStringId(value: string | { id: string } | null) {
    if (!value) {
      return null;
    }

    return typeof value === 'string' ? value : value.id;
  }

  private defaultInclude() {
    return {
      shipment: {
        select: {
          id: true,
          origin: true,
          destination: true,
          cargoType: true,
          status: true,
          broker: {
            select: {
              id: true,
              name: true,
              companyName: true,
            },
          },
        },
      },
    } satisfies Prisma.PaymentInclude;
  }
}
