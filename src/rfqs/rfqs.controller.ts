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
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { ListAvailableRfqsDto } from './dto/list-rfqs.dto';
import { UpdateRfqDto } from './dto/update-rfq.dto';
import { RfqsService } from './rfqs.service';

@Controller('rfqs')
export class RfqsController {
  constructor(private readonly rfqsService: RfqsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SHIPPER)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRfqDto) {
    return this.rfqsService.create(user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SHIPPER)
  @Get('my')
  findMine(@CurrentUser() user: AuthUser) {
    return this.rfqsService.findMine(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BROKER)
  @Get('available')
  findAvailable(@Query() query: ListAvailableRfqsDto) {
    return this.rfqsService.findAvailable(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.rfqsService.findOne(user, id);
  }

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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SHIPPER)
  @Patch(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.rfqsService.cancel(user, id);
  }
}
