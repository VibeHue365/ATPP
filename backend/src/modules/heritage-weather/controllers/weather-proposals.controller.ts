import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { WeatherProposalsService } from '../services/weather-proposals.service';
import { CreateWeatherProposalDto } from '../dto/create-weather-proposal.dto';
import { RespondWeatherProposalDto } from '../dto/respond-weather-proposal.dto';
import { CaptureProposalPaymentDto } from '../dto/capture-proposal-payment.dto';

@Controller('weather-proposals')
export class WeatherProposalsController {
  constructor(
    private readonly weatherProposalsService: WeatherProposalsService,
  ) {}

  /**
   * POST /weather-proposals/bookings/:bookingId
   * Customer submits a Plan B proposal
   */
  @Post('bookings/:bookingId')
  @UseGuards(JwtAuthGuard)
  async createProposal(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateWeatherProposalDto,
  ) {
    return this.weatherProposalsService.createProposal(
      bookingId,
      user.sub,
      dto,
    );
  }

  /**
   * GET /weather-proposals/bookings/:bookingId
   * Lists proposals for a specific booking
   */
  @Get('bookings/:bookingId')
  @UseGuards(JwtAuthGuard)
  async listProposalsForBooking(@Param('bookingId') bookingId: string) {
    return this.weatherProposalsService.listProposalsByBooking(bookingId);
  }

  /**
   * GET /weather-proposals/:id
   * Get proposal details by ID
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getProposal(@Param('id') id: string) {
    return this.weatherProposalsService.getProposal(id);
  }

  /**
   * PATCH /weather-proposals/:id/respond
   * Provider responds (APPROVED | REJECTED)
   */
  @Patch(':id/respond')
  @UseGuards(JwtAuthGuard)
  async respondProposal(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: RespondWeatherProposalDto,
  ) {
    return this.weatherProposalsService.respondProposal(id, user.sub, dto);
  }

  /**
   * POST /weather-proposals/:id/cancel
   * Customer cancels pending proposal
   */
  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelProposal(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.weatherProposalsService.cancelProposal(id, user.sub);
  }

  /**
   * POST /weather-proposals/capture-payment
   * Captures travel fee payment (called by payment webhook or direct payment handler)
   */
  @Post('capture-payment')
  async capturePayment(@Body() dto: CaptureProposalPaymentDto) {
    return this.weatherProposalsService.captureProposalPayment(
      dto.orderCode,
      dto.amount,
    );
  }
}
