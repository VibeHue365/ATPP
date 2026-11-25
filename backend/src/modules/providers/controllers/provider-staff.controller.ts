import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../../../common/pipes/parse-object-id.pipe';
import { ProviderStaffService } from '../services/provider-staff.service';
import {
  AddProviderStaffBlockDto,
  CreateProviderStaffDto,
  ProvisionStaffAccountDto,
  ResetStaffPasswordDto,
  ToggleStaffAccountLockDto,
  UpdateProviderCapacityDto,
  UpdateProviderStaffDto,
  UpdateProviderStaffStatusDto,
} from '../dto/provider-staff.dto';

@Controller(['providers', 'api/providers', 'api/v1/providers'])
export class ProviderStaffController {
  constructor(private readonly providerStaffService: ProviderStaffService) {}

  /** Provider Owner: list all staff with KPI summary & per-staff performance */
  @Get('me/staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROVIDER')
  listMine(@CurrentUser() user: AuthUser) {
    return this.providerStaffService.listForOwner(user.sub);
  }

  /** Provider Owner: add a new photographer staff member */
  @Post('me/staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROVIDER')
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProviderStaffDto,
  ) {
    return this.providerStaffService.create(user.sub, dto);
  }

  /** Provider Owner: update maxConcurrentSessions / maxDailySessions */
  @Patch('me/staff/capacity')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROVIDER')
  updateCapacity(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProviderCapacityDto,
  ) {
    return this.providerStaffService.updateCapacity(user.sub, dto);
  }

  /** Provider Owner: edit staff profile details */
  @Patch('me/staff/:staffId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROVIDER')
  update(
    @CurrentUser() user: AuthUser,
    @Param('staffId', new ParseObjectIdPipe('ID thợ chụp không hợp lệ'))
    staffId: string,
    @Body() dto: UpdateProviderStaffDto,
  ) {
    return this.providerStaffService.update(user.sub, staffId, dto);
  }

  /** Provider Owner: toggle ACTIVE / INACTIVE with future-booking guard */
  @Patch('me/staff/:staffId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROVIDER')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('staffId', new ParseObjectIdPipe('ID thợ chụp không hợp lệ'))
    staffId: string,
    @Body() dto: UpdateProviderStaffStatusDto,
  ) {
    return this.providerStaffService.updateStatus(
      user.sub,
      staffId,
      dto.status,
    );
  }

  /** Provider Owner: add off-day or blocked time range for a specific staff member */
  @Post('me/staff/:staffId/blocks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROVIDER')
  addBlockedSlot(
    @CurrentUser() user: AuthUser,
    @Param('staffId', new ParseObjectIdPipe('ID thợ chụp không hợp lệ'))
    staffId: string,
    @Body() dto: AddProviderStaffBlockDto,
  ) {
    return this.providerStaffService.addBlockedSlot(user.sub, staffId, dto);
  }

  /** Provider Owner: remove a blocked slot for a specific staff member */
  @Delete('me/staff/:staffId/blocks/:blockId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROVIDER')
  removeBlockedSlot(
    @CurrentUser() user: AuthUser,
    @Param('staffId', new ParseObjectIdPipe('ID thợ chụp không hợp lệ'))
    staffId: string,
    @Param('blockId', new ParseObjectIdPipe('ID lịch nghỉ không hợp lệ'))
    blockId: string,
  ) {
    return this.providerStaffService.removeBlockedSlot(
      user.sub,
      staffId,
      blockId,
    );
  }

  /** Provider Owner: provision isolated STAFF login account for an existing photographer */
  @Post('me/staff/:staffId/account')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROVIDER')
  provisionAccount(
    @CurrentUser() user: AuthUser,
    @Param('staffId', new ParseObjectIdPipe('ID thợ chụp không hợp lệ'))
    staffId: string,
    @Body() dto: ProvisionStaffAccountDto,
  ) {
    return this.providerStaffService.provisionAccount(user.sub, staffId, dto);
  }

  /** Provider Owner: reset linked STAFF password and revoke active sessions */
  @Post('me/staff/:staffId/account/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROVIDER')
  resetAccountPassword(
    @CurrentUser() user: AuthUser,
    @Param('staffId', new ParseObjectIdPipe('ID thợ chụp không hợp lệ'))
    staffId: string,
    @Body() dto: ResetStaffPasswordDto,
  ) {
    return this.providerStaffService.resetStaffPassword(
      user.sub,
      staffId,
      dto,
    );
  }

  /** Provider Owner: lock or unlock linked STAFF login account */
  @Patch('me/staff/:staffId/account/lock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROVIDER')
  toggleAccountLock(
    @CurrentUser() user: AuthUser,
    @Param('staffId', new ParseObjectIdPipe('ID thợ chụp không hợp lệ'))
    staffId: string,
    @Body() dto: ToggleStaffAccountLockDto,
  ) {
    return this.providerStaffService.setStaffAccountLocked(
      user.sub,
      staffId,
      dto,
    );
  }

  /** Public: list active photographer staff & capacity for a studio */
  @Get(':providerId/staff')
  listPublic(
    @Param('providerId', new ParseObjectIdPipe('ID nhà cung cấp không hợp lệ'))
    providerId: string,
  ) {
    return this.providerStaffService.listPublicByProvider(providerId);
  }
}
