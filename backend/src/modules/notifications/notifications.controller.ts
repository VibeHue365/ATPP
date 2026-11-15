import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { Notification } from './schemas/notification.schema';
import {
  RegisterPushTokenDto,
  UnregisterPushTokenDto,
} from './dto/push-token.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @CurrentUser() user: AuthUser,
  ): Promise<Notification[]> {
    return this.notificationsService.findAll(user.sub);
  }

  @Post('devices')
  async registerDevice(
    @Body() dto: RegisterPushTokenDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.notificationsService.registerPushToken(
      user.sub,
      dto.token,
      dto.platform,
    );
    return { registered: true };
  }

  @Delete('devices')
  async unregisterDevice(
    @Body() dto: UnregisterPushTokenDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.notificationsService.unregisterPushToken(user.sub, dto.token);
    return { registered: false };
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<Notification | null> {
    return this.notificationsService.markAsRead(id, user.sub);
  }

  @Post('read-all')
  async markAllAsRead(
    @CurrentUser() user: AuthUser,
  ): Promise<{ modifiedCount: number }> {
    return this.notificationsService.markAllAsRead(user.sub);
  }
}
