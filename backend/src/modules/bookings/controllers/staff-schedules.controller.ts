import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../../../common/pipes/parse-object-id.pipe';
import { StaffSchedulesService } from '../services/staff-schedules.service';
import {
  CreateStaffBlockedSlotDto,
  StaffCheckInDto,
  StaffFinishShootDto,
  StaffSchedulesQueryDto,
} from '../dto/staff-schedules.dto';

@Controller(['staff', 'api/staff', 'api/v1/staff'])
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('STAFF')
export class StaffSchedulesController {
  constructor(private readonly staffSchedulesService: StaffSchedulesService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: AuthUser) {
    return this.staffSchedulesService.getProfile(user.sub);
  }

  @Get('my-schedules')
  getMySchedules(
    @CurrentUser() user: AuthUser,
    @Query() query: StaffSchedulesQueryDto,
  ) {
    return this.staffSchedulesService.getMySchedules(user.sub, query);
  }

  @Post('schedules/:scheduleId/check-in')
  checkIn(
    @CurrentUser() user: AuthUser,
    @Param('scheduleId', new ParseObjectIdPipe('ID lịch chụp không hợp lệ'))
    scheduleId: string,
    @Body() dto: StaffCheckInDto,
  ) {
    return this.staffSchedulesService.checkIn(user.sub, scheduleId, dto);
  }

  @Post('schedules/:scheduleId/finish-shoot')
  finishShoot(
    @CurrentUser() user: AuthUser,
    @Param('scheduleId', new ParseObjectIdPipe('ID lịch chụp không hợp lệ'))
    scheduleId: string,
    @Body() dto: StaffFinishShootDto,
  ) {
    return this.staffSchedulesService.finishShoot(user.sub, scheduleId, dto);
  }

  @Post('blocked-slots')
  addMyBlockedSlot(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateStaffBlockedSlotDto,
  ) {
    return this.staffSchedulesService.addMyBlockedSlot(user.sub, dto);
  }

  @Delete('blocked-slots/:blockId')
  removeMyBlockedSlot(
    @CurrentUser() user: AuthUser,
    @Param('blockId', new ParseObjectIdPipe('ID lịch bận không hợp lệ'))
    blockId: string,
  ) {
    return this.staffSchedulesService.removeMyBlockedSlot(user.sub, blockId);
  }
}
