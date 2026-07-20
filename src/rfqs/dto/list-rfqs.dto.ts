import { ApiPropertyOptional } from '@nestjs/swagger';
import { RFQStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListAvailableRfqsDto {
  @ApiPropertyOptional({
    enum: RFQStatus,
    default: RFQStatus.OPEN,
    example: RFQStatus.OPEN,
  })
  @IsOptional()
  @IsEnum(RFQStatus)
  status?: RFQStatus;
}
