import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class UpdateRfqDto {
  @ApiPropertyOptional({ example: 'Dhaka, Bangladesh' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  origin?: string;

  @ApiPropertyOptional({ example: 'Chittagong Port, Bangladesh' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  destination?: string;

  @ApiPropertyOptional({ example: 'Electronics' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cargoType?: string;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    example: 1250.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  weight?: string | number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    example: 18.75,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  volume?: string | number | null;

  @ApiPropertyOptional({
    nullable: true,
    format: 'date-time',
    example: '2026-08-01T09:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  pickupDate?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    format: 'date-time',
    example: '2026-08-05T17:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  deliveryDate?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Handle with care.' })
  @IsOptional()
  @IsString()
  notes?: string | null;
}
