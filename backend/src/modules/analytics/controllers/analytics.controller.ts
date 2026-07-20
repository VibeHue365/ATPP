import { Controller, Post, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { AnalyticsService } from '../services/analytics.service';

@Controller('analytics')
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
}
