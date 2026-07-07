import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OfferStatus, Prisma, RFQStatus, UserRole } from '@prisma/client';
import type { AuthUser } from '../auth/types/auth-user.type';
import type { PrismaService } from '../prisma/prisma.service';
import { OffersService } from './offers.service';

describe('OffersService', () => {
  const shipper: AuthUser = {
    sub: 'shipper-1',
    email: 'shipper@example.com',
    role: UserRole.SHIPPER,
  };

  const baseOffer = {
    id: 'offer-1',
    rfqId: 'rfq-1',
    brokerId: 'broker-1',
    price: new Prisma.Decimal(1200),
    currency: 'USD',
    transitDays: 5,
    notes: null,
    status: OfferStatus.PENDING,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    rfq: {
      id: 'rfq-1',
      shipperId: 'shipper-1',
      origin: 'Dhaka',
      destination: 'Chattogram',
      cargoType: 'Textiles',
      weight: null,
      volume: null,
      pickupDate: null,
      deliveryDate: null,
      notes: null,
      status: RFQStatus.OPEN,
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    },
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
  };

  function createService(offer = baseOffer) {
    const tx = {
      offer: {
        findUnique: jest.fn().mockResolvedValue(offer),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      rFQ: {
        update: jest.fn().mockResolvedValue({}),
      },
      shipment: {
        create: jest.fn().mockResolvedValue(shipment),
      },
    };

    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    } as unknown as PrismaService;

    return {
      service: new OffersService(prisma),
      tx,
      prisma,
    };
  }

  describe('book', () => {
    it('books a pending offer and creates a shipment', async () => {
      const { service, tx } = createService();

      await expect(service.book(shipper, 'offer-1')).resolves.toBe(shipment);

      expect(tx.offer.findUnique).toHaveBeenCalledWith({
        where: { id: 'offer-1' },
        include: { rfq: true },
      });
      expect(tx.offer.update).toHaveBeenCalledWith({
        where: { id: 'offer-1' },
        data: { status: OfferStatus.ACCEPTED },
      });
      expect(tx.offer.updateMany).toHaveBeenCalledWith({
        where: {
          rfqId: 'rfq-1',
          id: { not: 'offer-1' },
          status: OfferStatus.PENDING,
        },
        data: { status: OfferStatus.REJECTED },
      });
      expect(tx.rFQ.update).toHaveBeenCalledWith({
        where: { id: 'rfq-1' },
        data: { status: RFQStatus.BOOKED },
      });
      expect(tx.shipment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            rfqId: 'rfq-1',
            offerId: 'offer-1',
            shipperId: 'shipper-1',
            brokerId: 'broker-1',
            origin: 'Dhaka',
            destination: 'Chattogram',
            cargoType: 'Textiles',
            price: baseOffer.price,
            currency: 'USD',
          },
        }),
      );
    });

    it('returns 404 when the offer does not belong to the shipper', async () => {
      const { service, tx } = createService({
        ...baseOffer,
        rfq: { ...baseOffer.rfq, shipperId: 'shipper-2' },
      });

      await expect(service.book(shipper, 'offer-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(tx.offer.update).not.toHaveBeenCalled();
      expect(tx.shipment.create).not.toHaveBeenCalled();
    });

    it('returns 400 when the RFQ is not open', async () => {
      const { service, tx } = createService({
        ...baseOffer,
        rfq: { ...baseOffer.rfq, status: RFQStatus.BOOKED },
      });

      await expect(service.book(shipper, 'offer-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(tx.offer.update).not.toHaveBeenCalled();
      expect(tx.shipment.create).not.toHaveBeenCalled();
    });

    it('returns 400 when the offer is not pending', async () => {
      const { service, tx } = createService({
        ...baseOffer,
        status: OfferStatus.WITHDRAWN,
      });

      await expect(service.book(shipper, 'offer-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(tx.offer.update).not.toHaveBeenCalled();
      expect(tx.shipment.create).not.toHaveBeenCalled();
    });
  });
});
