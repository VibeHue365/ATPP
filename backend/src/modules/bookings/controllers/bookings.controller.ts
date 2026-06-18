import { Controller, Post, Body, UseGuards, Get, Param } from '@nestjs/common';
import { BookingsService, CreateBookingDto, CreatePhotographyBookingDto } from '../services/bookings.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { BookingDocument } from '../schemas/booking.schema';

@Controller('api/bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateBookingDto,
  ): Promise<BookingDocument> {
    return this.bookingsService.createProductBooking(user.sub, body);
  }

  @Post('photography')
  @UseGuards(JwtAuthGuard)
  async createPhotography(
    @CurrentUser() user: AuthUser,
    @Body() body: CreatePhotographyBookingDto,
  ): Promise<BookingDocument> {
    return this.bookingsService.createPhotographyBooking(user.sub, body);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getMyBookings(@CurrentUser() user: AuthUser): Promise<any[]> {
    return this.bookingsService.getCustomerBookings(user.sub);
  }

  @Get('busy-dates/product/:productId')
  async getProductBusyDates(@Param('productId') productId: string) {
    return this.bookingsService.getBusySchedulesForProduct(productId);
  }

  @Get('busy-dates/provider/:providerId')
  async getProviderBusyDates(@Param('providerId') providerId: string) {
    return this.bookingsService.getBusySchedulesForProvider(providerId);
  }

  @Post(':bookingId/cancel')
  @UseGuards(JwtAuthGuard)
  async cancel(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Body('reason') reason?: string,
  ) {
    return this.bookingsService.cancelBooking(bookingId, user.sub, user.roles || [], reason);
  }
}
