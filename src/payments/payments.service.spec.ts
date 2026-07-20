import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  PaymentStatus,
  Prisma,
  ShipmentStatus,
  UserRole,
} from '@prisma/client';
import type { AuthUser } from '../auth/types/auth-user.type';
import type { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const shipper: AuthUser = {
    sub: 'shipper-1',
    email: 'shipper@example.com',
    role: UserRole.SHIPPER,
  };

  const admin: AuthUser = {
    sub: 'admin-1',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
  };

  const shipment = {
    id: 'shipment-1',
    rfqId: 'rfq-1',
    offerId: 'offer-1',
    shipperId: 'shipper-1',
    brokerId: 'broker-1',
    origin: 'Dhaka',
    destination: 'Chattogram',
    cargoType: 'Textiles',
    price: new Prisma.Decimal(1200),
    currency: 'USD',
    status: ShipmentStatus.DELIVERY_CONFIRMED,
    deliveredAt: new Date('2026-07-02T00:00:00.000Z'),
    confirmedAt: new Date('2026-07-03T00:00:00.000Z'),
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-03T00:00:00.000Z'),
    broker: {
      id: 'broker-1',
      stripeAccountId: 'acct_broker_123',
    },
    payment: null,
  };

  const payment = {
    id: 'payment-1',
    shipmentId: 'shipment-1',
    shipperId: 'shipper-1',
    amount: new Prisma.Decimal(1200),
    currency: 'USD',
    status: PaymentStatus.PENDING,
    grossAmount: new Prisma.Decimal(1200),
    platformFeeAmount: new Prisma.Decimal(120),
    brokerAmount: new Prisma.Decimal(1080),
    provider: 'stripe',
    providerRef: null,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    stripeTransferDestination: 'acct_broker_123',
    paidAt: null,
    createdAt: new Date('2026-07-04T00:00:00.000Z'),
    updatedAt: new Date('2026-07-04T00:00:00.000Z'),
  };

  const paymentWithShipment = {
    ...payment,
    shipment: {
      ...shipment,
      payment: undefined,
    },
  };

  function createService(options?: {
    shipment?: typeof shipment | null;
    payment?: typeof payment | null;
    stripeEvent?: { type: string; data: { object: any } };
  }) {
    const checkoutSession = {
      id: 'cs_test_1',
      url: 'https://checkout.stripe.com/c/pay/cs_test_1',
      payment_intent: 'pi_test_1',
    };

    const prisma = {
      $transaction: jest.fn((callback) => callback(prisma)),
      shipment: {
        findUnique: jest
          .fn()
          .mockResolvedValue(options?.shipment === undefined ? shipment : options.shipment),
        update: jest.fn().mockResolvedValue({
          ...shipment,
          status: ShipmentStatus.COMPLETED,
        }),
      },
      payment: {
        create: jest.fn().mockResolvedValue(payment),
        update: jest.fn().mockResolvedValue({
          ...payment,
          providerRef: 'cs_test_1',
          stripeCheckoutSessionId: 'cs_test_1',
          stripePaymentIntentId: 'pi_test_1',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([payment]),
        findUnique: jest
          .fn()
          .mockResolvedValue(
            options?.payment === undefined ? paymentWithShipment : options.payment,
          ),
        findFirst: jest.fn().mockResolvedValue(options?.payment ?? payment),
        findUniqueOrThrow: jest.fn().mockResolvedValue(payment),
      },
    } as unknown as PrismaService;

    const stripeService = {
      createCheckoutSession: jest.fn().mockResolvedValue(checkoutSession),
      retrieveCheckoutSession: jest.fn().mockResolvedValue(checkoutSession),
      constructWebhookEvent: jest.fn().mockReturnValue(
        options?.stripeEvent ?? {
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_test_1',
              payment_intent: 'pi_test_1',
              metadata: { paymentId: 'payment-1' },
            },
          },
        },
      ),
    };

    return {
      service: new PaymentsService(prisma, stripeService as any),
      prisma,
      shipmentClient: prisma.shipment,
      paymentClient: prisma.payment,
      stripeService,
    };
  }

  describe('create', () => {
    it('creates a pending payment from a delivery-confirmed shipment', async () => {
      const { service, paymentClient, stripeService } = createService();

      await expect(service.create(shipper, 'shipment-1')).resolves.toBe(payment);

      expect(paymentClient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shipmentId: 'shipment-1',
            shipperId: 'shipper-1',
            amount: shipment.price,
            grossAmount: shipment.price,
            platformFeeAmount: new Prisma.Decimal(120),
            brokerAmount: new Prisma.Decimal(1080),
            currency: 'USD',
            status: PaymentStatus.PENDING,
            provider: null,
            providerRef: null,
            stripeCheckoutSessionId: null,
            stripePaymentIntentId: null,
            stripeTransferDestination: 'acct_broker_123',
            paidAt: null,
          }),
        }),
      );
      expect(stripeService.createCheckoutSession).not.toHaveBeenCalled();
    });

    it('returns 404 for hidden shipments', async () => {
      const { service, paymentClient } = createService({
        shipment: { ...shipment, shipperId: 'shipper-2' },
      });

      await expect(service.create(shipper, 'shipment-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(paymentClient.create).not.toHaveBeenCalled();
    });

    it('rejects shipments that are not delivery-confirmed', async () => {
      const { service, paymentClient } = createService({
        shipment: { ...shipment, status: ShipmentStatus.DELIVERED },
      });

      await expect(service.create(shipper, 'shipment-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(paymentClient.create).not.toHaveBeenCalled();
    });

    it('returns and refreshes accounting fields for an existing payment', async () => {
      const { service, paymentClient, stripeService } = createService({
        shipment: { ...shipment, payment: { id: 'payment-1' } },
      });

      await expect(service.create(shipper, 'shipment-1')).resolves.toMatchObject({
        id: 'payment-1',
      });
      expect(paymentClient.create).not.toHaveBeenCalled();
      expect(paymentClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'payment-1' },
          data: expect.objectContaining({
            grossAmount: shipment.price,
            platformFeeAmount: new Prisma.Decimal(120),
            brokerAmount: new Prisma.Decimal(1080),
            stripeTransferDestination: 'acct_broker_123',
          }),
        }),
      );
      expect(stripeService.createCheckoutSession).not.toHaveBeenCalled();
    });
  });

  describe('createCheckoutSession', () => {
    it('creates a Stripe Checkout session for a pending payment', async () => {
      const { service, paymentClient, stripeService } = createService();

      await expect(
        service.createCheckoutSession(shipper, 'payment-1'),
      ).resolves.toMatchObject({
        id: 'payment-1',
        checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_1',
      });

      expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: 'payment-1',
          amount: payment.amount,
          platformFeeAmount: new Prisma.Decimal(120),
          brokerStripeAccountId: 'acct_broker_123',
        }),
      );
      expect(paymentClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            provider: 'stripe',
            providerRef: 'cs_test_1',
            stripeCheckoutSessionId: 'cs_test_1',
            stripePaymentIntentId: 'pi_test_1',
            stripeTransferDestination: 'acct_broker_123',
          }),
        }),
      );
    });

    it('reuses an existing pending Checkout session', async () => {
      const existingPayment = {
        ...paymentWithShipment,
        stripeCheckoutSessionId: 'cs_test_1',
      };
      const { service, stripeService } = createService({
        payment: existingPayment,
      });

      await expect(
        service.createCheckoutSession(shipper, 'payment-1'),
      ).resolves.toMatchObject({
        id: 'payment-1',
        checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_1',
      });

      expect(stripeService.retrieveCheckoutSession).toHaveBeenCalledWith(
        'cs_test_1',
      );
      expect(stripeService.createCheckoutSession).not.toHaveBeenCalled();
    });

    it('rejects checkout when the broker has no connected account', async () => {
      const { service, paymentClient } = createService({
        payment: {
          ...paymentWithShipment,
          shipment: {
            ...paymentWithShipment.shipment,
            broker: { id: 'broker-1', stripeAccountId: null },
          },
        },
      });

      await expect(
        service.createCheckoutSession(shipper, 'payment-1'),
      ).rejects.toThrow(BadRequestException);
      expect(paymentClient.update).not.toHaveBeenCalled();
    });

    it('returns 404 for hidden payments', async () => {
      const { service } = createService({
        payment: { ...paymentWithShipment, shipperId: 'shipper-2' },
      });

      await expect(
        service.createCheckoutSession(shipper, 'payment-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects non-pending payments', async () => {
      const { service } = createService({
        payment: { ...paymentWithShipment, status: PaymentStatus.PAID },
      });

      await expect(
        service.createCheckoutSession(shipper, 'payment-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleStripeWebhook', () => {
    it('marks payment paid and shipment completed for successful checkout', async () => {
      const { service, paymentClient, shipmentClient } = createService();

      await expect(
        service.handleStripeWebhook(Buffer.from('{}'), 'sig'),
      ).resolves.toEqual({ received: true });

      expect(paymentClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'payment-1' },
          data: expect.objectContaining({
            status: PaymentStatus.PAID,
            stripePaymentIntentId: 'pi_test_1',
          }),
        }),
      );
      expect(shipmentClient.update).toHaveBeenCalledWith({
        where: { id: 'shipment-1' },
        data: { status: ShipmentStatus.COMPLETED },
      });
    });

    it('marks payment failed for async checkout failures', async () => {
      const { service, paymentClient } = createService({
        stripeEvent: {
          type: 'checkout.session.async_payment_failed',
          data: {
            object: {
              id: 'cs_test_1',
              payment_intent: 'pi_test_1',
              metadata: { paymentId: 'payment-1' },
            },
          },
        },
      });

      await expect(
        service.handleStripeWebhook(Buffer.from('{}'), 'sig'),
      ).resolves.toEqual({ received: true });

      expect(paymentClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'payment-1' },
          data: expect.objectContaining({ status: PaymentStatus.FAILED }),
        }),
      );
    });

    it('marks payments refunded from charge refund events', async () => {
      const { service, paymentClient } = createService({
        stripeEvent: {
          type: 'charge.refunded',
          data: { object: { payment_intent: 'pi_test_1' } },
        },
      });

      await expect(
        service.handleStripeWebhook(Buffer.from('{}'), 'sig'),
      ).resolves.toEqual({ received: true });

      expect(paymentClient.updateMany).toHaveBeenCalledWith({
        where: { stripePaymentIntentId: 'pi_test_1' },
        data: { status: PaymentStatus.REFUNDED },
      });
    });

    it('ignores unrelated verified Stripe events', () => {
      const { service, paymentClient } = createService({
        stripeEvent: {
          type: 'customer.created',
          data: { object: { id: 'cus_test_1' } },
        },
      });

      expect(service.handleStripeWebhook(Buffer.from('{}'), 'sig')).toEqual({
        received: true,
      });
      expect(paymentClient.update).not.toHaveBeenCalled();
    });
  });

  describe('findMine', () => {
    it('lists current shipper payments newest first', async () => {
      const { service, paymentClient } = createService();

      await expect(service.findMine(shipper)).resolves.toEqual([payment]);

      expect(paymentClient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { shipperId: 'shipper-1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns payment detail for the owning shipper', async () => {
      const { service } = createService();

      await expect(service.findOne(shipper, 'payment-1')).resolves.toMatchObject({
        id: 'payment-1',
      });
    });

    it('returns payment detail for admins', async () => {
      const { service } = createService();

      await expect(service.findOne(admin, 'payment-1')).resolves.toMatchObject({
        id: 'payment-1',
      });
    });

    it('returns 404 for hidden payments', async () => {
      const { service } = createService({
        payment: { ...payment, shipperId: 'shipper-2' },
      });

      await expect(service.findOne(shipper, 'payment-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
