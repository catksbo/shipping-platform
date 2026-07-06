import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Offer, OfferStatus, Prisma, RFQStatus, UserRole } from '@prisma/client';
import { AuthUser } from '../auth/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';

@Injectable()
export class OffersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthUser, rfqId: string, dto: CreateOfferDto) {
    const rfq = await this.prisma.rFQ.findUnique({ where: { id: rfqId } });

    if (!rfq) {
      throw new NotFoundException('RFQ not found');
    }

    if (rfq.status !== RFQStatus.OPEN) {
      throw new BadRequestException('Offers can only be created for open RFQs');
    }

    const existingOffer = await this.prisma.offer.findUnique({
      where: {
        rfqId_brokerId: {
          rfqId,
          brokerId: user.sub,
        },
      },
    });

    if (existingOffer) {
      throw new ConflictException('Broker already has an offer on this RFQ');
    }

    return this.prisma.offer.create({
      data: {
        ...this.buildCreateData(dto),
        rfqId,
        brokerId: user.sub,
      },
      include: this.defaultInclude(),
    });
  }

  findMine(user: AuthUser) {
    return this.prisma.offer.findMany({
      where: { brokerId: user.sub },
      orderBy: { createdAt: 'desc' },
      include: this.defaultInclude(),
    });
  }

  async findForRfq(user: AuthUser, rfqId: string) {
    const rfq = await this.prisma.rFQ.findUnique({ where: { id: rfqId } });

    if (!rfq || rfq.shipperId !== user.sub) {
      throw new NotFoundException('RFQ not found');
    }

    return this.prisma.offer.findMany({
      where: { rfqId },
      orderBy: { createdAt: 'desc' },
      include: this.defaultInclude(),
    });
  }

  async findOne(user: AuthUser, id: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id },
      include: this.defaultInclude(),
    });

    if (!offer || !this.canView(user, offer)) {
      throw new NotFoundException('Offer not found');
    }

    return offer;
  }

  async update(user: AuthUser, id: string, dto: UpdateOfferDto) {
    const offer = await this.findOwnedPendingOfferOnOpenRfq(user, id);

    return this.prisma.offer.update({
      where: { id: offer.id },
      data: this.buildUpdateData(dto),
      include: this.defaultInclude(),
    });
  }

  async withdraw(user: AuthUser, id: string) {
    const offer = await this.findOwnedPendingOfferOnOpenRfq(user, id);

    return this.prisma.offer.update({
      where: { id: offer.id },
      data: { status: OfferStatus.WITHDRAWN },
      include: this.defaultInclude(),
    });
  }

  private async findOwnedPendingOfferOnOpenRfq(user: AuthUser, id: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id },
      include: { rfq: true },
    });

    if (!offer || offer.brokerId !== user.sub) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException('Only pending offers can be changed');
    }

    if (offer.rfq.status !== RFQStatus.OPEN) {
      throw new BadRequestException('Offers can only be changed while RFQ is open');
    }

    return offer;
  }

  private canView(user: AuthUser, offer: Offer & { rfq: { shipperId: string } }) {
    if (user.role === UserRole.BROKER) {
      return offer.brokerId === user.sub;
    }

    if (user.role === UserRole.SHIPPER) {
      return offer.rfq.shipperId === user.sub;
    }

    return user.role === UserRole.ADMIN;
  }

  private buildCreateData(
    dto: CreateOfferDto,
  ): Omit<Prisma.OfferUncheckedCreateInput, 'rfqId' | 'brokerId'> {
    return {
      price: this.parsePositiveDecimal(dto.price, 'price'),
      currency: this.parseCurrency(dto.currency),
      transitDays: this.parseOptionalPositiveInteger(
        dto.transitDays,
        'transitDays',
      ),
      notes: this.optionalText(dto.notes),
    };
  }

  private buildUpdateData(dto: UpdateOfferDto): Prisma.OfferUncheckedUpdateInput {
    const data: Prisma.OfferUncheckedUpdateInput = {};

    if (dto.price !== undefined) {
      data.price = this.parsePositiveDecimal(dto.price, 'price');
    }

    if (dto.currency !== undefined) {
      data.currency = this.parseCurrency(dto.currency);
    }

    if (dto.transitDays !== undefined) {
      data.transitDays =
        dto.transitDays === null
          ? null
          : this.parseOptionalPositiveInteger(dto.transitDays, 'transitDays');
    }

    if (dto.notes !== undefined) {
      data.notes = dto.notes === null ? null : this.optionalText(dto.notes);
    }

    return data;
  }

  private parsePositiveDecimal(value: unknown, field: string) {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue) || numberValue <= 0) {
      throw new BadRequestException(`${field} must be a positive number`);
    }

    return new Prisma.Decimal(numberValue);
  }

  private parseOptionalPositiveInteger(value: unknown, field: string) {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const numberValue = Number(value);

    if (!Number.isInteger(numberValue) || numberValue <= 0) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }

    return numberValue;
  }

  private parseCurrency(value: unknown) {
    if (value === undefined || value === null || value === '') {
      return 'USD';
    }

    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException('currency must be a string');
    }

    return value.trim().toUpperCase();
  }

  private optionalText(value: unknown) {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException('notes must be a string');
    }

    const trimmedValue = value.trim();
    return trimmedValue.length ? trimmedValue : null;
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
          shipperId: true,
        },
      },
      broker: {
        select: {
          id: true,
          name: true,
          companyName: true,
        },
      },
    } satisfies Prisma.OfferInclude;
  }
}
