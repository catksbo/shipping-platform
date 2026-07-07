import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { PaymentsService } from './payments.service';

@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SHIPPER)
  @Post('shipments/:shipmentId/payments')
  create(
    @CurrentUser() user: AuthUser,
    @Param('shipmentId') shipmentId: string,
  ) {
    return this.paymentsService.create(user, shipmentId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SHIPPER)
  @Get('payments/my')
  findMine(@CurrentUser() user: AuthUser) {
    return this.paymentsService.findMine(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('payments/:id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.paymentsService.findOne(user, id);
  }
}
