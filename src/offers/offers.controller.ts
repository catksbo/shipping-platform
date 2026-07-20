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
  ApiConflictResponse,
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
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { OffersService } from './offers.service';

@ApiTags('Offers')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller()
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @ApiOperation({ summary: 'Create one broker offer for an open RFQ' })
  @ApiParam({ name: 'rfqId', description: 'RFQ ID' })
  @ApiCreatedResponse({ description: 'Offer created.' })
  @ApiBadRequestResponse({ description: 'Invalid payload or RFQ is not open.' })
  @ApiForbiddenResponse({ description: 'Only brokers can create offers.' })
  @ApiNotFoundResponse({ description: 'RFQ not found.' })
  @ApiConflictResponse({ description: 'Broker already has an offer on this RFQ.' })
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

  @ApiOperation({ summary: 'List offers created by the current broker' })
  @ApiOkResponse({ description: 'Current broker offers.' })
  @ApiForbiddenResponse({ description: 'Only brokers can list their own offers.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BROKER)
  @Get('offers/my')
  findMine(@CurrentUser() user: AuthUser) {
    return this.offersService.findMine(user);
  }

  @ApiOperation({ summary: 'List offers received for a shipper-owned RFQ' })
  @ApiParam({ name: 'rfqId', description: 'RFQ ID' })
  @ApiOkResponse({ description: 'Offers received for the RFQ.' })
  @ApiForbiddenResponse({ description: 'Only shippers can list RFQ offers.' })
  @ApiNotFoundResponse({ description: 'RFQ not found or hidden.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SHIPPER)
  @Get('rfqs/:rfqId/offers')
  findForRfq(@CurrentUser() user: AuthUser, @Param('rfqId') rfqId: string) {
    return this.offersService.findForRfq(user, rfqId);
  }

  @ApiOperation({ summary: 'Get offer detail when authorized' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiOkResponse({ description: 'Offer detail.' })
  @ApiNotFoundResponse({ description: 'Offer not found or hidden.' })
  @UseGuards(JwtAuthGuard)
  @Get('offers/:id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.offersService.findOne(user, id);
  }

  @ApiOperation({ summary: 'Book a pending offer as the RFQ owner' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiCreatedResponse({ description: 'Offer booked and shipment created.' })
  @ApiBadRequestResponse({ description: 'Offer or RFQ cannot be booked.' })
  @ApiForbiddenResponse({ description: 'Only shippers can book offers.' })
  @ApiNotFoundResponse({ description: 'Offer not found or hidden.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SHIPPER)
  @Post('offers/:id/book')
  book(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.offersService.book(user, id);
  }

  @ApiOperation({ summary: 'Update a broker-owned pending offer' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiOkResponse({ description: 'Offer updated.' })
  @ApiBadRequestResponse({ description: 'Invalid payload or offer cannot be changed.' })
  @ApiForbiddenResponse({ description: 'Only brokers can update offers.' })
  @ApiNotFoundResponse({ description: 'Offer not found or hidden.' })
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

  @ApiOperation({ summary: 'Withdraw a broker-owned pending offer' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiOkResponse({ description: 'Offer withdrawn.' })
  @ApiBadRequestResponse({ description: 'Offer cannot be changed.' })
  @ApiForbiddenResponse({ description: 'Only brokers can withdraw offers.' })
  @ApiNotFoundResponse({ description: 'Offer not found or hidden.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BROKER)
  @Patch('offers/:id/withdraw')
  withdraw(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.offersService.withdraw(user, id);
  }
}
