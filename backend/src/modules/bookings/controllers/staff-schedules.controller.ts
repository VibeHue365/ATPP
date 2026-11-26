import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UnsupportedMediaTypeException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../../../common/pipes/parse-object-id.pipe';
import { PublicMediaService } from '../../storage/services/public-media.service';
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
  constructor(
    private readonly staffSchedulesService: StaffSchedulesService,
    private readonly publicMedia: PublicMediaService,
  ) {}

  @Post('check-in-photo')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          callback(
            new UnsupportedMediaTypeException(
              'Chỉ hỗ trợ định dạng ảnh JPG, PNG hoặc WEBP.',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
      storage: memoryStorage(),
    }),
  )
  async uploadCheckInPhoto(
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn hoặc chụp ảnh xác nhận.');
    }
    const upload = await this.publicMedia.uploadImage('staff-checkins', file);
    return { url: upload.url };
  }

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
