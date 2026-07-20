import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateRfqDto {
  @ApiProperty({ example: 'Dhaka, Bangladesh' })
  @IsString()
  @IsNotEmpty()
  origin!: string;

  @ApiProperty({ example: 'Chittagong Port, Bangladesh' })
  @IsString()
  @IsNotEmpty()
  destination!: string;

  @ApiProperty({ example: 'Electronics' })
  @IsString()
  @IsNotEmpty()
  cargoType!: string;

  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    example: 1250.5,
    description: 'Positive shipment weight.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  weight?: string | number;

  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    example: 18.75,
    description: 'Positive shipment volume.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  volume?: string | number;

  @ApiPropertyOptional({
    format: 'date-time',
    example: '2026-08-01T09:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  pickupDate?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    example: '2026-08-05T17:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @ApiPropertyOptional({ example: 'Handle with care.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
