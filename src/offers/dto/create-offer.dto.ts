import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
} from 'class-validator';

export class CreateOfferDto {
  @ApiProperty({ type: Number, minimum: 0, example: 2750.5 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  price!: string | number;

  @ApiPropertyOptional({
    default: 'USD',
    example: 'USD',
    description: 'Three-letter uppercase currency code.',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  transitDays?: string | number;

  @ApiPropertyOptional({ nullable: true, example: 'Includes port handling.' })
  @IsOptional()
  @IsString()
  notes?: string | null;
}
