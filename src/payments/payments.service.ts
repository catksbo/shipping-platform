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
import type { AuthUser } from '../auth/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthUser, shipmentId: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
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

    if (shipment.payment) {
      throw new BadRequestException('Payment already exists for this shipment');
    }

    return this.prisma.payment.create({
      data: {
        shipmentId: shipment.id,
        shipperId: shipment.shipperId,
        amount: shipment.price,
        currency: shipment.currency,
        status: PaymentStatus.PENDING,
        provider: null,
        providerRef: null,
        paidAt: null,
      },
      include: this.defaultInclude(),
    });
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

  private canView(user: AuthUser, payment: Payment) {
    if (user.role === UserRole.SHIPPER) {
      return payment.shipperId === user.sub;
    }

    return user.role === UserRole.ADMIN;
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
