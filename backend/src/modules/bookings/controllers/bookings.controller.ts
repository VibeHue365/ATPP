import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { BookingsService } from '../services/bookings.service';
import { BookingDocument } from '../schemas/booking.schema';
import {
  CreateBookingDto,
  CreateProductBookingDto,
  CreatePhotographyBookingDto,
} from '../services/bookings.service';
import { IsString, IsNotEmpty } from 'class-validator';

export class CancelBookingDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

@Controller(['bookings', 'api/bookings'])
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /** POST /bookings hoặc POST /api/bookings — Tạo booking tổng hợp hoặc booking đơn lẻ */
  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() body: any,
  ): Promise<BookingDocument> {
    if (body && Array.isArray(body.items)) {
      return this.bookingsService.createBooking(user.sub, body as CreateBookingDto);
    } else {
      return this.bookingsService.createProductBooking(user.sub, body as CreateProductBookingDto);
    }
  }

  /** POST /bookings/product hoặc POST /api/bookings/product */
  @Post('product')
  async createProduct(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProductBookingDto,
  ) {
    return this.bookingsService.createProductBooking(user.sub, dto);
  }

  /** POST /bookings/photography hoặc POST /api/bookings/photography */
  @Post('photography')
  async createPhotography(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePhotographyBookingDto,
  ) {
    return this.bookingsService.createPhotographyBooking(user.sub, dto);
  }

  /** GET /bookings/my hoặc GET /api/bookings/my */
  @Get('my')
  async getMy(@CurrentUser() user: AuthUser): Promise<Record<string, any>[]> {
    return this.bookingsService.getMyBookings(user.sub);
  }

  /** GET /bookings/provider hoặc GET /api/bookings/provider */
  @Get('provider')
  async getProvider(
    @CurrentUser() user: AuthUser,
  ): Promise<Record<string, any>[]> {
    return this.bookingsService.getProviderBookings(user.sub);
  }

  /** GET /bookings/:id hoặc GET /api/bookings/:id */
  @Get(':id')
  async getById(@Param('id') id: string): Promise<Record<string, any>> {
    return this.bookingsService.getBookingById(id);
  }

  /** POST /bookings/:id/complete hoặc POST /api/bookings/:id/complete */
  @Post(':id/complete')
  async complete(@Param('id') id: string) {
    return this.bookingsService.completeBooking(id);
  }

  /** POST /bookings/:id/cancel hoặc POST /api/bookings/:id/cancel */
  @Post(':id/cancel')
  async cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const reason = body?.reason || (typeof body === 'string' ? body : undefined);
    return this.bookingsService.cancelBooking(id, user.sub, user.roles || [], reason);
  }

  /** GET /bookings hoặc GET /api/bookings */
  @Get()
  async getMyBookings(@CurrentUser() user: AuthUser): Promise<any[]> {
    return this.bookingsService.getCustomerBookings(user.sub);
  }

  /** GET /bookings/busy-dates/product/:productId hoặc GET /api/bookings/busy-dates/product/:productId */
  @Get('busy-dates/product/:productId')
  async getProductBusyDates(@Param('productId') productId: string) {
    return this.bookingsService.getBusySchedulesForProduct(productId);
  }

  /** GET /bookings/busy-dates/provider/:providerId hoặc GET /api/bookings/busy-dates/provider/:providerId */
  @Get('busy-dates/provider/:providerId')
  async getProviderBusyDates(@Param('providerId') providerId: string) {
    return this.bookingsService.getBusySchedulesForProvider(providerId);
  }
}
