import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentStatus,
  Prisma,
  Shipment,
  ShipmentStatus,
  UserRole,
} from '@prisma/client';
import type { AuthUser } from '../auth/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';

@Injectable()
export class ShipmentsService {
  private readonly brokerManagedStatuses: ShipmentStatus[] = [
    ShipmentStatus.PICKED_UP,
    ShipmentStatus.IN_TRANSIT,
    ShipmentStatus.DELIVERED,
    ShipmentStatus.CANCELLED,
  ];

  private readonly terminalStatuses: ShipmentStatus[] = [
    ShipmentStatus.DELIVERY_CONFIRMED,
    ShipmentStatus.COMPLETED,
    ShipmentStatus.CANCELLED,
  ];

  constructor(private readonly prisma: PrismaService) {}

  findMine(user: AuthUser) {
    return this.prisma.shipment.findMany({
      where: this.mineWhere(user),
      orderBy: { createdAt: 'desc' },
      include: this.defaultInclude(),
    });
  }

  async findOne(user: AuthUser, id: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: this.defaultInclude(),
    });

    if (!shipment || !this.canView(user, shipment)) {
      throw new NotFoundException('Shipment not found');
    }

    return shipment;
  }

  async updateStatus(
    user: AuthUser,
    id: string,
    dto: UpdateShipmentStatusDto,
  ) {
    const shipment = await this.prisma.shipment.findUnique({ where: { id } });

    if (!shipment || shipment.brokerId !== user.sub) {
      throw new NotFoundException('Shipment not found');
    }

    if (this.terminalStatuses.includes(shipment.status)) {
      throw new BadRequestException('Terminal shipments cannot be changed');
    }

    const status = this.parseBrokerStatus(dto.status);
    const data: Prisma.ShipmentUncheckedUpdateInput = { status };

    if (status === ShipmentStatus.DELIVERED && !shipment.deliveredAt) {
      data.deliveredAt = new Date();
    }

    return this.prisma.shipment.update({
      where: { id: shipment.id },
      data,
      include: this.defaultInclude(),
    });
  }

  async confirmDelivery(user: AuthUser, id: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: {
        broker: {
          select: { stripeAccountId: true },
        },
      },
    });

    if (!shipment || shipment.shipperId !== user.sub) {
      throw new NotFoundException('Shipment not found');
    }

    if (shipment.status !== ShipmentStatus.DELIVERED) {
      throw new BadRequestException('Only delivered shipments can be confirmed');
    }

    const grossAmount = shipment.price;
    const platformFeeAmount = this.calculatePlatformFee(grossAmount);
    const brokerAmount = grossAmount.minus(platformFeeAmount);

    return this.prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          status: ShipmentStatus.DELIVERY_CONFIRMED,
          confirmedAt: new Date(),
        },
      });

      await tx.payment.create({
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
      });

      return tx.shipment.findUniqueOrThrow({
        where: { id: shipment.id },
        include: this.defaultInclude(),
      });
    });
  }

  private mineWhere(user: AuthUser): Prisma.ShipmentWhereInput {
    if (user.role === UserRole.SHIPPER) {
      return { shipperId: user.sub };
    }

    if (user.role === UserRole.BROKER) {
      return { brokerId: user.sub };
    }

    return {};
  }

  private canView(user: AuthUser, shipment: Shipment) {
    if (user.role === UserRole.SHIPPER) {
      return shipment.shipperId === user.sub;
    }

    if (user.role === UserRole.BROKER) {
      return shipment.brokerId === user.sub;
    }

    return user.role === UserRole.ADMIN;
  }

  private parseBrokerStatus(status: ShipmentStatus) {
    if (!this.brokerManagedStatuses.includes(status)) {
      throw new BadRequestException('Invalid shipment status');
    }

    return status;
  }

  private calculatePlatformFee(amount: Prisma.Decimal) {
    const feePercent = new Prisma.Decimal(
      process.env.PLATFORM_FEE_PERCENT ?? '10',
    );

    return amount.mul(feePercent).div(100).toDecimalPlaces(2);
  }

  private defaultInclude() {
    return {
      rfq: {
        select: {
          id: true,
          origin: true,
          destination: true,
          cargoType: true,
          status: true,
        },
      },
      offer: {
        select: {
          id: true,
          price: true,
          currency: true,
          transitDays: true,
          status: true,
        },
      },
      broker: {
        select: {
          id: true,
          name: true,
          companyName: true,
        },
      },
      shipper: {
        select: {
          id: true,
          name: true,
          companyName: true,
        },
      },
      payment: {
        select: {
          id: true,
          status: true,
          amount: true,
          currency: true,
        },
      },
    } satisfies Prisma.ShipmentInclude;
  }
}
