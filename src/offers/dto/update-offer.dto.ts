import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
} from 'class-validator';

export class UpdateOfferDto {
  @ApiPropertyOptional({ type: Number, minimum: 0, example: 2750.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  price?: string | number;

  @ApiPropertyOptional({
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

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 1,
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  transitDays?: string | number | null;

  @ApiPropertyOptional({ nullable: true, example: 'Includes port handling.' })
  @IsOptional()
  @IsString()
  notes?: string | null;
}
