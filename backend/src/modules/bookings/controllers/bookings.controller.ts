import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { BookingsService, CreateBookingDto, CreatePhotographyBookingDto } from '../services/bookings.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { BookingDocument } from '../schemas/booking.schema';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateBookingDto,
  ): Promise<BookingDocument> {
    return this.bookingsService.createProductBooking(user.sub, body);
  }

  @Post('photography')
  async createPhotography(
    @CurrentUser() user: AuthUser,
    @Body() body: CreatePhotographyBookingDto,
  ): Promise<BookingDocument> {
    return this.bookingsService.createPhotographyBooking(user.sub, body);
  }
}
