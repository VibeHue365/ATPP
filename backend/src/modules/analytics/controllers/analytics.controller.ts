import { Controller, Post, Body, Param, HttpCode, HttpStatus, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from '../services/analytics.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';

@Controller(['analytics', 'api/v1/analytics'])
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /** POST /analytics/search — Frontend gọi mỗi khi user tìm kiếm */
  @Post('search')
  @HttpCode(HttpStatus.NO_CONTENT)
  async trackSearch(@Body('keyword') keyword: string): Promise<void> {
    if (keyword) await this.analyticsService.trackSearch(keyword);
  }

  /** POST /analytics/products/:id/view — Frontend gọi khi user mở trang chi tiết sản phẩm */
  @Post('products/:id/view')
  @HttpCode(HttpStatus.NO_CONTENT)
  async trackProductView(@Param('id') id: string): Promise<void> {
    if (id) await this.analyticsService.trackProductView(id);
  }

  /** VS-116: Admin report for popular searches and products with zero bookings. */
  @Get('user-behavior')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('ADMIN')
  @Permissions('dashboard:read')
  async getUserBehavior(
    @Query('limit') limit?: string,
    @Query('minViews') minViews?: string,
  ) {
    const parsedLimit = Number(limit);
    const parsedMinViews = Number(minViews);
    return this.analyticsService.getUserBehavior(
      Number.isFinite(parsedLimit) ? parsedLimit : 10,
      Number.isFinite(parsedMinViews) ? parsedMinViews : 100,
    );
  }
}
