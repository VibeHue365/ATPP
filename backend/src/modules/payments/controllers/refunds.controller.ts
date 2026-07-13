import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { ApproveRefundDto, CreateRefundDto, ProcessRefundDto, RefundActionDto } from '../dto/refund.dto';
import { RefundMode, RefundStatus } from '../schemas/refund-request.schema';
import { RefundWorkflowService } from '../services/refund-workflow.service';

@Controller('refunds')
@UseGuards(JwtAuthGuard)
export class RefundsController {
  constructor(private readonly refunds: RefundWorkflowService) {}

  @Get('mine')
  listMine(@CurrentUser() user: AuthUser) { return this.refunds.listMine(user.sub); }

  @Get('mine/:id')
  getMine(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.refunds.getMine(id, user.sub); }

  @Post('bookings/:bookingId')
  create(@Param('bookingId') bookingId: string, @Body() dto: CreateRefundDto, @Headers('idempotency-key') idempotencyKey: string | undefined, @CurrentUser() user: AuthUser) {
    if (!idempotencyKey) throw new BadRequestException('Idempotency-Key header is required');
    return this.refunds.createCustomerRequest(bookingId, user.sub, dto.amount, dto.reason, idempotencyKey);
  }

  @Get('bookings/:bookingId/eligibility')
  eligibility(@Param('bookingId') bookingId: string, @CurrentUser() user: AuthUser) {
    return this.refunds.getEligibility(bookingId, user.sub);
  }

  @Get('admin')
  @UseGuards(PermissionsGuard)
  @Permissions('refund:read')
  listAdmin(@Query('status') status?: RefundStatus) { return this.refunds.listAdmin(status); }

  @Post('admin/:id/approve')
  @UseGuards(PermissionsGuard)
  @Permissions('refund:manage')
  approve(@Param('id') id: string, @Body() dto: ApproveRefundDto, @CurrentUser() user: AuthUser) { return this.refunds.approve(id, user.sub, dto.amount, dto.expectedVersion, dto.reason); }

  @Post('admin/:id/reject')
  @UseGuards(PermissionsGuard)
  @Permissions('refund:manage')
  reject(@Param('id') id: string, @Body() dto: RefundActionDto, @CurrentUser() user: AuthUser) { return this.refunds.reject(id, user.sub, dto.expectedVersion, dto.reason); }

  @Post('admin/:id/process')
  @UseGuards(PermissionsGuard)
  @Permissions('refund:manage')
  process(@Param('id') id: string, @Body() dto: ProcessRefundDto, @CurrentUser() user: AuthUser) { return this.refunds.process(id, user.sub, dto.expectedVersion, dto.mode ?? RefundMode.Simulated, dto.reference); }

  @Post('admin/:id/retry')
  @UseGuards(PermissionsGuard)
  @Permissions('refund:manage')
  retry(@Param('id') id: string, @Body() dto: ProcessRefundDto, @CurrentUser() user: AuthUser) { return this.refunds.retry(id, user.sub, dto.expectedVersion, dto.mode ?? RefundMode.Simulated, dto.reference); }
}
