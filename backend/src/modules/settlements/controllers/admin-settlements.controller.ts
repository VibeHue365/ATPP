import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import {
  HoldSettlementDto,
  MarkSettlementSettledDto,
  QuerySettlementsDto,
  RegenerateSettlementsDto,
  ReleaseSettlementDto,
} from '../dto/settlement.dto';
import { SettlementQueryService } from '../services/settlement-query.service';
import { SettlementsService } from '../services/settlements.service';

interface RequestMeta {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

@Controller('admin/settlements')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('ADMIN')
export class AdminSettlementsController {
  constructor(
    private readonly settlementsService: SettlementsService,
    private readonly settlementQueryService: SettlementQueryService,
  ) {}

  @Get()
  @Permissions('settlement:read')
  findAll(@Query() query: QuerySettlementsDto) {
    return this.settlementQueryService.findAdminSettlements(query);
  }

  @Get('booking/:bookingId')
  @Permissions('settlement:read')
  findByBooking(@Param('bookingId') bookingId: string) {
    return this.settlementQueryService.findByBookingId(bookingId);
  }

  @Post('booking/:bookingId/regenerate')
  @Permissions('settlement:manage')
  regenerate(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Body() dto: RegenerateSettlementsDto,
    @Req() request: RequestMeta,
  ) {
    return this.settlementsService.regenerateSettlementsForBooking(
      bookingId,
      user.sub,
      dto,
      this.context(request),
    );
  }

  @Get(':id')
  @Permissions('settlement:read')
  findOne(@Param('id') id: string) {
    return this.settlementQueryService.findById(id);
  }

  @Patch(':id/hold')
  @Permissions('settlement:manage')
  hold(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: HoldSettlementDto,
    @Req() request: RequestMeta,
  ) {
    return this.settlementsService.holdSettlement(
      user.sub,
      id,
      dto,
      this.context(request),
    );
  }

  @Patch(':id/release')
  @Permissions('settlement:manage')
  release(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReleaseSettlementDto,
    @Req() request: RequestMeta,
  ) {
    return this.settlementsService.releaseSettlement(
      user.sub,
      id,
      dto,
      this.context(request),
    );
  }

  @Patch(':id/mark-settled')
  @Permissions('settlement:manage')
  markSettled(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: MarkSettlementSettledDto,
    @Req() request: RequestMeta,
  ) {
    return this.settlementsService.markSettled(
      user.sub,
      id,
      dto,
      this.context(request),
    );
  }

  private context(request: RequestMeta) {
    const userAgent = request.headers['user-agent'];

    return {
      ipAddress: request.ip,
      userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    };
  }
}
