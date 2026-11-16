import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { WeatherCancellationsService } from '../services/weather-cancellations.service';
import { SubmitWeatherCancellationDto } from '../dto/submit-weather-cancellation.dto';

@Controller('weather-cancellations')
export class WeatherCancellationsController {
  constructor(
    private readonly weatherCancellationsService: WeatherCancellationsService,
  ) {}

  /**
   * POST /weather-cancellations/bookings/:bookingId
   * Customer submits a weather cancellation request (AD-03).
   */
  @Post('bookings/:bookingId')
  @UseGuards(JwtAuthGuard)
  async submitCancellation(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SubmitWeatherCancellationDto,
  ) {
    return this.weatherCancellationsService.submitCancellationRequest(
      bookingId,
      user.sub,
      dto,
    );
  }

  /**
   * GET /weather-cancellations/bookings/:bookingId
   * Customer/partner checks weather cancellation status for a booking.
   */
  @Get('bookings/:bookingId')
  @UseGuards(JwtAuthGuard)
  async getBookingCancellation(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.weatherCancellationsService.getBookingCancellationRequest(
      bookingId,
      user.sub,
    );
  }

  /**
   * GET /weather-cancellations/:id
   * Get weather cancellation request by ID.
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getCancellationById(@Param('id') id: string) {
    return this.weatherCancellationsService.getCancellationRequestById(id);
  }
}
