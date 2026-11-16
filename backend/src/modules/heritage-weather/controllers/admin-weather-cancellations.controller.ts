import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { WeatherCancellationsService } from '../services/weather-cancellations.service';
import { AdminReviewWeatherCancellationDto } from '../dto/admin-review-weather-cancellation.dto';
import { ListWeatherCancellationsQueryDto } from '../dto/list-weather-cancellations-query.dto';

@Controller('admin/weather-cancellations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminWeatherCancellationsController {
  constructor(
    private readonly weatherCancellationsService: WeatherCancellationsService,
  ) {}

  /**
   * GET /admin/weather-cancellations
   * Admin lists and filters weather cancellation requests.
   */
  @Get()
  async listCancellations(@Query() query: ListWeatherCancellationsQueryDto) {
    return this.weatherCancellationsService.listCancellationRequests(query);
  }

  /**
   * GET /admin/weather-cancellations/:id
   * Admin retrieves details of a specific weather cancellation request.
   */
  @Get(':id')
  async getCancellationDetails(@Param('id') id: string) {
    return this.weatherCancellationsService.getCancellationRequestById(id);
  }

  /**
   * PATCH /admin/weather-cancellations/:id/review
   * Admin reviews and decides on a weather cancellation request (AD-03).
   */
  @Patch(':id/review')
  async reviewCancellation(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AdminReviewWeatherCancellationDto,
  ) {
    return this.weatherCancellationsService.adminReviewCancellation(
      id,
      user.sub,
      dto,
    );
  }
}
