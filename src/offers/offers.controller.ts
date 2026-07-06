import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { OffersService } from './offers.service';

@Controller()
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BROKER)
  @Post('rfqs/:rfqId/offers')
  create(
    @CurrentUser() user: AuthUser,
    @Param('rfqId') rfqId: string,
    @Body() dto: CreateOfferDto,
  ) {
    return this.offersService.create(user, rfqId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BROKER)
  @Get('offers/my')
  findMine(@CurrentUser() user: AuthUser) {
    return this.offersService.findMine(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SHIPPER)
  @Get('rfqs/:rfqId/offers')
  findForRfq(@CurrentUser() user: AuthUser, @Param('rfqId') rfqId: string) {
    return this.offersService.findForRfq(user, rfqId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('offers/:id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.offersService.findOne(user, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BROKER)
  @Patch('offers/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateOfferDto,
  ) {
    return this.offersService.update(user, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BROKER)
  @Patch('offers/:id/withdraw')
  withdraw(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.offersService.withdraw(user, id);
  }
}
