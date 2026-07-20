import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { ShipmentsService } from './shipments.service';

@ApiTags('Shipments')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @ApiOperation({ summary: 'List shipments for the current shipper or broker' })
  @ApiOkResponse({ description: 'Current user shipments.' })
  @ApiForbiddenResponse({ description: 'Only shippers and brokers can list shipments.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SHIPPER, UserRole.BROKER)
  @Get('my')
  findMine(@CurrentUser() user: AuthUser) {
    return this.shipmentsService.findMine(user);
  }

  @ApiOperation({ summary: 'Get shipment detail when authorized' })
  @ApiParam({ name: 'id', description: 'Shipment ID' })
  @ApiOkResponse({ description: 'Shipment detail.' })
  @ApiNotFoundResponse({ description: 'Shipment not found or hidden.' })
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.shipmentsService.findOne(user, id);
  }

  @ApiOperation({ summary: 'Update broker-managed shipment status' })
  @ApiParam({ name: 'id', description: 'Shipment ID' })
  @ApiOkResponse({ description: 'Shipment status updated.' })
  @ApiBadRequestResponse({ description: 'Invalid status or terminal shipment.' })
  @ApiForbiddenResponse({ description: 'Only assigned brokers can update status.' })
  @ApiNotFoundResponse({ description: 'Shipment not found or hidden.' })
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

  @ApiOperation({
    summary: 'Confirm delivery and create a pending payment option',
  })
  @ApiParam({ name: 'id', description: 'Shipment ID' })
  @ApiCreatedResponse({ description: 'Delivery confirmed and pending payment created.' })
  @ApiBadRequestResponse({ description: 'Shipment has not been delivered.' })
  @ApiForbiddenResponse({ description: 'Only shippers can confirm delivery.' })
  @ApiNotFoundResponse({ description: 'Shipment not found or hidden.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SHIPPER)
  @Post(':id/confirm-delivery')
  confirmDelivery(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.shipmentsService.confirmDelivery(user, id);
  }
}
