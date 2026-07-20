import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RFQStatus, UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { ListAvailableRfqsDto } from './dto/list-rfqs.dto';
import { UpdateRfqDto } from './dto/update-rfq.dto';
import { RfqsService } from './rfqs.service';

@ApiTags('RFQs')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('rfqs')
export class RfqsController {
  constructor(private readonly rfqsService: RfqsService) {}

  @ApiOperation({ summary: 'Create an RFQ as a shipper' })
  @ApiCreatedResponse({ description: 'RFQ created.' })
  @ApiBadRequestResponse({ description: 'Invalid RFQ payload.' })
  @ApiForbiddenResponse({ description: 'Only shippers can create RFQs.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SHIPPER)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRfqDto) {
    return this.rfqsService.create(user, dto);
  }

  @ApiOperation({ summary: 'List RFQs owned by the current shipper' })
  @ApiOkResponse({ description: 'Current shipper RFQs.' })
  @ApiForbiddenResponse({ description: 'Only shippers can list their own RFQs.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SHIPPER)
  @Get('my')
  findMine(@CurrentUser() user: AuthUser) {
    return this.rfqsService.findMine(user);
  }

  @ApiOperation({ summary: 'List RFQs available to brokers' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: RFQStatus,
    description: 'RFQ status filter. Defaults to OPEN.',
  })
  @ApiOkResponse({ description: 'Available RFQs.' })
  @ApiBadRequestResponse({ description: 'Invalid RFQ status query.' })
  @ApiForbiddenResponse({ description: 'Only brokers can list available RFQs.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BROKER)
  @Get('available')
  findAvailable(@Query() query: ListAvailableRfqsDto) {
    return this.rfqsService.findAvailable(query);
  }

  @ApiOperation({ summary: 'Get RFQ detail when authorized' })
  @ApiParam({ name: 'id', description: 'RFQ ID' })
  @ApiOkResponse({ description: 'RFQ detail.' })
  @ApiNotFoundResponse({ description: 'RFQ not found or hidden.' })
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.rfqsService.findOne(user, id);
  }

  @ApiOperation({ summary: 'Update an open RFQ owned by the current shipper' })
  @ApiParam({ name: 'id', description: 'RFQ ID' })
  @ApiOkResponse({ description: 'RFQ updated.' })
  @ApiBadRequestResponse({ description: 'Invalid payload or RFQ is not open.' })
  @ApiForbiddenResponse({ description: 'Only shippers can update RFQs.' })
  @ApiNotFoundResponse({ description: 'RFQ not found or hidden.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SHIPPER)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateRfqDto,
  ) {
    return this.rfqsService.update(user, id, dto);
  }

  @ApiOperation({ summary: 'Cancel an open RFQ owned by the current shipper' })
  @ApiParam({ name: 'id', description: 'RFQ ID' })
  @ApiOkResponse({ description: 'RFQ cancelled.' })
  @ApiBadRequestResponse({ description: 'RFQ is not open.' })
  @ApiForbiddenResponse({ description: 'Only shippers can cancel RFQs.' })
  @ApiNotFoundResponse({ description: 'RFQ not found or hidden.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SHIPPER)
  @Patch(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.rfqsService.cancel(user, id);
  }
}
