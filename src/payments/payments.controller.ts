import {
  Controller,
  Get,
  Headers,
  Query,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
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
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiOperation({ summary: 'Create a pending payment for a confirmed shipment' })
  @ApiParam({ name: 'shipmentId', description: 'Shipment ID' })
  @ApiCreatedResponse({
    description: 'Payment created or existing payment returned.',
  })
  @ApiBadRequestResponse({
    description: 'Shipment is not delivery-confirmed or payment already exists.',
  })
  @ApiForbiddenResponse({ description: 'Only shippers can create payments.' })
  @ApiNotFoundResponse({ description: 'Shipment not found or hidden.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SHIPPER)
  @Post('shipments/:shipmentId/payments')
  create(
    @CurrentUser() user: AuthUser,
    @Param('shipmentId') shipmentId: string,
  ) {
    return this.paymentsService.create(user, shipmentId);
  }

  @ApiOperation({ summary: 'Create or reuse a Stripe Checkout Session' })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiCreatedResponse({ description: 'Stripe Checkout URL returned.' })
  @ApiBadRequestResponse({
    description:
      'Payment is not pending, shipment is not delivery-confirmed, or broker has no Stripe connected account.',
  })
  @ApiNotFoundResponse({ description: 'Payment not found or hidden.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SHIPPER)
  @Post('payments/:id/checkout-session')
  createCheckoutSession(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.paymentsService.createCheckoutSession(user, id);
  }

  @ApiOperation({ summary: 'Receive Stripe payment webhooks' })
  @ApiOkResponse({ description: 'Webhook received.' })
  @ApiBadRequestResponse({ description: 'Invalid Stripe webhook signature.' })
  @Post('payments/stripe/webhook')
  handleStripeWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.paymentsService.handleStripeWebhook(
      request.rawBody ?? Buffer.from(JSON.stringify(request.body)),
      signature ?? '',
    );
  }

  @ApiOperation({ summary: 'Stripe Checkout success redirect' })
  @ApiOkResponse({ description: 'Checkout success redirect received.' })
  @Get('payments/success')
  checkoutSuccess(@Query('session_id') sessionId?: string) {
    return {
      status: 'success',
      message: 'Payment completed. Webhook processing will update the payment status.',
      sessionId: sessionId ?? null,
    };
  }

  @ApiOperation({ summary: 'Stripe Checkout cancel redirect' })
  @ApiOkResponse({ description: 'Checkout cancel redirect received.' })
  @Get('payments/cancel')
  checkoutCancel() {
    return {
      status: 'cancelled',
      message: 'Payment checkout was cancelled.',
    };
  }

  @ApiOperation({ summary: 'List payments for the current shipper' })
  @ApiOkResponse({ description: 'Current shipper payments.' })
  @ApiForbiddenResponse({ description: 'Only shippers can list their own payments.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SHIPPER)
  @Get('payments/my')
  findMine(@CurrentUser() user: AuthUser) {
    return this.paymentsService.findMine(user);
  }

  @ApiOperation({ summary: 'Get payment detail when authorized' })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiOkResponse({ description: 'Payment detail.' })
  @ApiNotFoundResponse({ description: 'Payment not found or hidden.' })
  @UseGuards(JwtAuthGuard)
  @Get('payments/:id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.paymentsService.findOne(user, id);
  }
}
