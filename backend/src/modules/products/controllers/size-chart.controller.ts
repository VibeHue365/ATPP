import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { RateLimitService } from '../../auth/services/rate-limit.service';
import { SizeChartImageService } from '../services/size-chart-image.service';
import { SizeChartImageDto } from '../dto/size-chart.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../../common/guards/optional-jwt-auth.guard';
import { SizeRecommendationDto } from '../dto/size-recommendation.dto';
import { SizeRecommendationService } from '../services/size-recommendation.service';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { ChartVersionDto, SaveSizeChartDto } from '../dto/size-chart.dto';
import { SizeChartService } from '../services/size-chart.service';

@Controller(['products', 'api/products'])
export class SizeChartController {
  constructor(
    private readonly charts: SizeChartService,
    private readonly images: SizeChartImageService,
    private readonly rateLimit: RateLimitService,
    private readonly recommendations: SizeRecommendationService,
  ) {}

  @Post(':id/size-recommendation')
  @UseGuards(OptionalJwtAuthGuard)
  recommend(
    @CurrentUser() user: AuthUser | null,
    @Param('id') id: string,
    @Body() dto: SizeRecommendationDto,
  ) {
    return this.recommendations.recommend(id, dto, user?.sub);
  }

  @Post(':id/size-chart/image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    }),
  )
  async upload(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SizeChartImageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    await this.rateLimit.assertRateLimit(`size_chart_image_${user.sub}`, 5, 60);
    return this.images.uploadAndExtract(user.sub, id, dto, file);
  }
  @Get(':id/size-chart')
  getPublic(@Param('id') id: string) {
    return this.charts.getPublic(id);
  }
  @Get('my-listings/:id/size-chart')
  @UseGuards(JwtAuthGuard)
  getOwned(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.charts.getOwned(user.sub, id);
  }
  @Patch(':id/size-chart')
  @UseGuards(JwtAuthGuard)
  save(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SaveSizeChartDto,
  ) {
    return this.charts.saveDraft(user.sub, id, dto);
  }
  @Post(':id/size-chart/confirm')
  @UseGuards(JwtAuthGuard)
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ChartVersionDto,
  ) {
    return this.charts.confirm(user.sub, id, dto.expectedVersion);
  }
}
