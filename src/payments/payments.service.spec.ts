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
    payment: null,
  };

  const payment = {
    id: 'payment-1',
    shipmentId: 'shipment-1',
    shipperId: 'shipper-1',
    amount: new Prisma.Decimal(1200),
    currency: 'USD',
    status: PaymentStatus.PENDING,
    provider: null,
    providerRef: null,
    paidAt: null,
    createdAt: new Date('2026-07-04T00:00:00.000Z'),
    updatedAt: new Date('2026-07-04T00:00:00.000Z'),
  };

  function createService(options?: {
    shipment?: typeof shipment | null;
    payment?: typeof payment | null;
  }) {
    const prisma = {
      shipment: {
        findUnique: jest
          .fn()
          .mockResolvedValue(options?.shipment === undefined ? shipment : options.shipment),
      },
      payment: {
        create: jest.fn().mockResolvedValue(payment),
        findMany: jest.fn().mockResolvedValue([payment]),
        findUnique: jest
          .fn()
          .mockResolvedValue(options?.payment === undefined ? payment : options.payment),
      },
    } as unknown as PrismaService;

    return {
      service: new PaymentsService(prisma),
      prisma,
      shipmentClient: prisma.shipment,
      paymentClient: prisma.payment,
    };
  }

  describe('create', () => {
    it('creates a pending payment from a delivery-confirmed shipment', async () => {
      const { service, paymentClient } = createService();

      await expect(service.create(shipper, 'shipment-1')).resolves.toBe(payment);

      expect(paymentClient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            shipmentId: 'shipment-1',
            shipperId: 'shipper-1',
            amount: shipment.price,
            currency: 'USD',
            status: PaymentStatus.PENDING,
            provider: null,
            providerRef: null,
            paidAt: null,
          },
        }),
      );
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

    it('rejects duplicate payments', async () => {
      const { service, paymentClient } = createService({
        shipment: { ...shipment, payment: { id: 'payment-1' } },
      });

      await expect(service.create(shipper, 'shipment-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(paymentClient.create).not.toHaveBeenCalled();
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

      await expect(service.findOne(shipper, 'payment-1')).resolves.toBe(payment);
    });

    it('returns payment detail for admins', async () => {
      const { service } = createService();

      await expect(service.findOne(admin, 'payment-1')).resolves.toBe(payment);
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
