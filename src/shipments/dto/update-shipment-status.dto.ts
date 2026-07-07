import { ShipmentStatus } from '@prisma/client';

export class UpdateShipmentStatusDto {
  status!: ShipmentStatus;
}
