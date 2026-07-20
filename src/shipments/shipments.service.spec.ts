import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma, ShipmentStatus, UserRole } from '@prisma/client';
import type { AuthUser } from '../auth/types/auth-user.type';
import type { PrismaService } from '../prisma/prisma.service';
import { ShipmentsService } from './shipments.service';

describe('ShipmentsService', () => {
  const shipper: AuthUser = {
    sub: 'shipper-1',
    email: 'shipper@example.com',
    role: UserRole.SHIPPER,
  };

  const broker: AuthUser = {
    sub: 'broker-1',
    email: 'broker@example.com',
    role: UserRole.BROKER,
  };

  const baseShipment = {
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
    status: ShipmentStatus.BOOKED,
    deliveredAt: null,
    confirmedAt: null,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    broker: {
      stripeAccountId: 'acct_broker_123',
    },
  };

  const basePayment = {
    id: 'payment-1',
    shipmentId: 'shipment-1',
    shipperId: 'shipper-1',
    amount: new Prisma.Decimal(1200),
    grossAmount: new Prisma.Decimal(1200),
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
    createdAt: new Date('2026-07-03T00:00:00.000Z'),
    updatedAt: new Date('2026-07-03T00:00:00.000Z'),
  };

  function createService(shipment = baseShipment) {
    const prisma = {
      $transaction: jest.fn((callback) => callback(prisma)),
      shipment: {
        findMany: jest.fn().mockResolvedValue([shipment]),
        findUnique: jest.fn().mockResolvedValue(shipment),
        update: jest.fn().mockResolvedValue(shipment),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...shipment,
          status: ShipmentStatus.DELIVERY_CONFIRMED,
          confirmedAt: new Date('2026-07-03T00:00:00.000Z'),
          payment: basePayment,
        }),
      },
      payment: {
        create: jest.fn().mockResolvedValue(basePayment),
      },
    } as unknown as PrismaService;

    return {
      service: new ShipmentsService(prisma),
      prisma,
      shipmentClient: prisma.shipment,
      paymentClient: prisma.payment,
    };
  }

  describe('findMine', () => {
    it('lists shipments for the current shipper', async () => {
      const { service, shipmentClient } = createService();

      await expect(service.findMine(shipper)).resolves.toEqual([baseShipment]);

      expect(shipmentClient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { shipperId: 'shipper-1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('lists shipments for the current broker', async () => {
      const { service, shipmentClient } = createService();

      await service.findMine(broker);

      expect(shipmentClient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { brokerId: 'broker-1' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns a shipment visible to the current user', async () => {
      const { service } = createService();

      await expect(service.findOne(shipper, 'shipment-1')).resolves.toBe(
        baseShipment,
      );
    });

    it('returns 404 for hidden shipments', async () => {
      const { service } = createService({
        ...baseShipment,
        shipperId: 'shipper-2',
      });

      await expect(service.findOne(shipper, 'shipment-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStatus', () => {
    it('lets the assigned broker mark a shipment delivered', async () => {
      const { service, shipmentClient } = createService();

      await service.updateStatus(broker, 'shipment-1', {
        status: ShipmentStatus.DELIVERED,
      });

      expect(shipmentClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'shipment-1' },
          data: {
            status: ShipmentStatus.DELIVERED,
            deliveredAt: expect.any(Date),
          },
        }),
      );
    });

    it('returns 404 when the broker does not own the shipment', async () => {
      const { service, shipmentClient } = createService({
        ...baseShipment,
        brokerId: 'broker-2',
      });

      await expect(
        service.updateStatus(broker, 'shipment-1', {
          status: ShipmentStatus.IN_TRANSIT,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(shipmentClient.update).not.toHaveBeenCalled();
    });

    it('rejects statuses managed by other workflow steps', async () => {
      const { service, shipmentClient } = createService();

      await expect(
        service.updateStatus(broker, 'shipment-1', {
          status: ShipmentStatus.DELIVERY_CONFIRMED,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(shipmentClient.update).not.toHaveBeenCalled();
    });

    it('rejects updates to terminal shipments', async () => {
      const { service, shipmentClient } = createService({
        ...baseShipment,
        status: ShipmentStatus.DELIVERY_CONFIRMED,
      });

      await expect(
        service.updateStatus(broker, 'shipment-1', {
          status: ShipmentStatus.IN_TRANSIT,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(shipmentClient.update).not.toHaveBeenCalled();
    });
  });

  describe('confirmDelivery', () => {
    it('lets the shipper confirm a delivered shipment', async () => {
      const { service, shipmentClient, paymentClient } = createService({
        ...baseShipment,
        status: ShipmentStatus.DELIVERED,
        deliveredAt: new Date('2026-07-02T00:00:00.000Z'),
      });

      await service.confirmDelivery(shipper, 'shipment-1');

      expect(shipmentClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'shipment-1' },
          data: {
            status: ShipmentStatus.DELIVERY_CONFIRMED,
            confirmedAt: expect.any(Date),
          },
        }),
      );
      expect(paymentClient.create).toHaveBeenCalledWith({
        data: {
          shipmentId: 'shipment-1',
          shipperId: 'shipper-1',
          amount: baseShipment.price,
          grossAmount: baseShipment.price,
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
        },
      });
      expect(shipmentClient.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'shipment-1' },
        }),
      );
    });

    it('returns 404 when the shipper does not own the shipment', async () => {
      const { service, shipmentClient } = createService({
        ...baseShipment,
        shipperId: 'shipper-2',
      });

      await expect(
        service.confirmDelivery(shipper, 'shipment-1'),
      ).rejects.toThrow(NotFoundException);
      expect(shipmentClient.update).not.toHaveBeenCalled();
    });

    it('requires the shipment to be delivered first', async () => {
      const { service, shipmentClient } = createService();

      await expect(
        service.confirmDelivery(shipper, 'shipment-1'),
      ).rejects.toThrow(BadRequestException);
      expect(shipmentClient.update).not.toHaveBeenCalled();
    });
  });
});
