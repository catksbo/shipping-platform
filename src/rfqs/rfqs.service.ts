import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RFQ, RFQStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/types/auth-user.type';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { ListAvailableRfqsDto } from './dto/list-rfqs.dto';
import { UpdateRfqDto } from './dto/update-rfq.dto';

@Injectable()
export class RfqsService {
  constructor(private readonly prisma: PrismaService) {}

  create(user: AuthUser, dto: CreateRfqDto) {
    const data = this.buildCreateData(dto);

    return this.prisma.rFQ.create({
      data: {
        ...data,
        shipperId: user.sub,
      },
      include: this.defaultInclude(),
    });
  }

  findMine(user: AuthUser) {
    return this.prisma.rFQ.findMany({
      where: { shipperId: user.sub },
      orderBy: { createdAt: 'desc' },
      include: this.defaultInclude(),
    });
  }

  findAvailable(query: ListAvailableRfqsDto) {
    const status = this.parseStatus(query.status ?? RFQStatus.OPEN);

    return this.prisma.rFQ.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      include: this.defaultInclude(),
    });
  }

  async findOne(user: AuthUser, id: string) {
    const rfq = await this.prisma.rFQ.findUnique({
      where: { id },
      include: this.defaultInclude(),
    });

    if (!rfq || !this.canView(user, rfq)) {
      throw new NotFoundException('RFQ not found');
    }

    return rfq;
  }

  async update(user: AuthUser, id: string, dto: UpdateRfqDto) {
    const rfq = await this.findOwnedOpenRfq(user, id);
    const data = this.buildUpdateData(dto);

    return this.prisma.rFQ.update({
      where: { id: rfq.id },
      data,
      include: this.defaultInclude(),
    });
  }

  async cancel(user: AuthUser, id: string) {
    const rfq = await this.findOwnedOpenRfq(user, id);

    return this.prisma.rFQ.update({
      where: { id: rfq.id },
      data: { status: RFQStatus.CANCELLED },
      include: this.defaultInclude(),
    });
  }

  private async findOwnedOpenRfq(user: AuthUser, id: string) {
    const rfq = await this.prisma.rFQ.findUnique({ where: { id } });

    if (!rfq) {
      throw new NotFoundException('RFQ not found');
    }

    if (rfq.shipperId !== user.sub) {
      throw new NotFoundException('RFQ not found');
    }

    if (rfq.status !== RFQStatus.OPEN) {
      throw new BadRequestException('Only open RFQs can be changed');
    }

    return rfq;
  }

  private canView(user: AuthUser, rfq: RFQ) {
    if (user.role === UserRole.SHIPPER) {
      return rfq.shipperId === user.sub;
    }

    if (user.role === UserRole.BROKER) {
      return true;
    }

    return user.role === UserRole.ADMIN;
  }

  private buildCreateData(
    dto: CreateRfqDto,
  ): Omit<Prisma.RFQUncheckedCreateInput, 'shipperId'> {
    const origin = this.requireText(dto.origin, 'origin');
    const destination = this.requireText(dto.destination, 'destination');
    const cargoType = this.requireText(dto.cargoType, 'cargoType');
    const pickupDate = this.parseOptionalDate(dto.pickupDate, 'pickupDate');
    const deliveryDate = this.parseOptionalDate(
      dto.deliveryDate,
      'deliveryDate',
    );

    this.validateDateOrder(pickupDate, deliveryDate);

    return {
      origin,
      destination,
      cargoType,
      weight: this.parseOptionalPositiveDecimal(dto.weight, 'weight'),
      volume: this.parseOptionalPositiveDecimal(dto.volume, 'volume'),
      pickupDate,
      deliveryDate,
      notes: this.optionalText(dto.notes),
    };
  }

  private buildUpdateData(dto: UpdateRfqDto): Prisma.RFQUncheckedUpdateInput {
    const data: Prisma.RFQUncheckedUpdateInput = {};

    if (dto.origin !== undefined) {
      data.origin = this.requireText(dto.origin, 'origin');
    }

    if (dto.destination !== undefined) {
      data.destination = this.requireText(dto.destination, 'destination');
    }

    if (dto.cargoType !== undefined) {
      data.cargoType = this.requireText(dto.cargoType, 'cargoType');
    }

    if (dto.weight !== undefined) {
      data.weight =
        dto.weight === null
          ? null
          : this.parseOptionalPositiveDecimal(dto.weight, 'weight');
    }

    if (dto.volume !== undefined) {
      data.volume =
        dto.volume === null
          ? null
          : this.parseOptionalPositiveDecimal(dto.volume, 'volume');
    }

    const pickupDate =
      dto.pickupDate === undefined
        ? undefined
        : this.parseNullableDate(dto.pickupDate, 'pickupDate');
    const deliveryDate =
      dto.deliveryDate === undefined
        ? undefined
        : this.parseNullableDate(dto.deliveryDate, 'deliveryDate');

    if (pickupDate !== undefined) {
      data.pickupDate = pickupDate;
    }

    if (deliveryDate !== undefined) {
      data.deliveryDate = deliveryDate;
    }

    if (pickupDate instanceof Date && deliveryDate instanceof Date) {
      this.validateDateOrder(pickupDate, deliveryDate);
    }

    if (dto.notes !== undefined) {
      data.notes = dto.notes === null ? null : this.optionalText(dto.notes);
    }

    return data;
  }

  private requireText(value: unknown, field: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }

    return value.trim();
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

  private parseOptionalPositiveDecimal(value: unknown, field: string) {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const numberValue = Number(value);

    if (!Number.isFinite(numberValue) || numberValue <= 0) {
      throw new BadRequestException(`${field} must be a positive number`);
    }

    return new Prisma.Decimal(numberValue);
  }

  private parseOptionalDate(value: unknown, field: string) {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    return this.parseDate(value, field);
  }

  private parseNullableDate(value: unknown, field: string) {
    if (value === null || value === '') {
      return null;
    }

    if (value === undefined) {
      return undefined;
    }

    return this.parseDate(value, field);
  }

  private parseDate(value: unknown, field: string) {
    if (typeof value !== 'string') {
      throw new BadRequestException(`${field} must be a date string`);
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid date`);
    }

    return date;
  }

  private validateDateOrder(pickupDate?: Date | null, deliveryDate?: Date | null) {
    if (pickupDate && deliveryDate && deliveryDate < pickupDate) {
      throw new BadRequestException('deliveryDate cannot be before pickupDate');
    }
  }

  private parseStatus(status: RFQStatus) {
    if (!Object.values(RFQStatus).includes(status)) {
      throw new BadRequestException('Invalid RFQ status');
    }

    return status;
  }

  private defaultInclude() {
    return {
      _count: {
        select: {
          offers: true,
        },
      },
    } satisfies Prisma.RFQInclude;
  }
}
