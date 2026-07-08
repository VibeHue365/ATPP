import { Controller, Get, Patch, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { Notification } from './schemas/notification.schema';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(@CurrentUser() user: AuthUser): Promise<Notification[]> {
    return this.notificationsService.findAll(user.sub);
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<Notification | null> {
    return this.notificationsService.markAsRead(id, user.sub);
  }

  @Post('read-all')
  async markAllAsRead(@CurrentUser() user: AuthUser): Promise<{ modifiedCount: number }> {
    return this.notificationsService.markAllAsRead(user.sub);
  }
}
