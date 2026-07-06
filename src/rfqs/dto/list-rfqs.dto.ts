import { RFQStatus } from '@prisma/client';

export class ListAvailableRfqsDto {
  status?: RFQStatus;
}
