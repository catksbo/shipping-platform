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
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { ShipmentsService } from './shipments.service';

@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SHIPPER, UserRole.BROKER)
  @Get('my')
  findMine(@CurrentUser() user: AuthUser) {
    return this.shipmentsService.findMine(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.shipmentsService.findOne(user, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BROKER)
  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateShipmentStatusDto,
  ) {
    return this.shipmentsService.updateStatus(user, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SHIPPER)
  @Post(':id/confirm-delivery')
  confirmDelivery(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.shipmentsService.confirmDelivery(user, id);
  }
}
