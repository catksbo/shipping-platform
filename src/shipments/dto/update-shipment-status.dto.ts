import { ApiProperty } from '@nestjs/swagger';
import { ShipmentStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

const brokerManagedShipmentStatuses = [
  ShipmentStatus.PICKED_UP,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.DELIVERED,
  ShipmentStatus.CANCELLED,
] as const;

export class UpdateShipmentStatusDto {
  @ApiProperty({
    enum: brokerManagedShipmentStatuses,
    example: ShipmentStatus.IN_TRANSIT,
  })
  @IsEnum(brokerManagedShipmentStatuses)
  status!: ShipmentStatus;
}
