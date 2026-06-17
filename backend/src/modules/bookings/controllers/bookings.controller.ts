import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { BookingsService } from '../services/bookings.service';
import { BookingType } from '../schemas/booking.schema';

export class BookingItemDto {
  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  photographyPackageId?: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsString()
  @IsOptional()
  rentalFrom?: string;

  @IsString()
  @IsOptional()
  rentalTo?: string;

  @IsString()
  @IsOptional()
  shootDate?: string;

  @IsString()
  @IsOptional()
  shootTimeSlot?: string;

  @IsString()
  @IsOptional()
  customRequests?: string;
}

export class CreateBookingDto {
  @IsEnum(BookingType)
  bookingType: BookingType;

  @IsArray()
  @IsNotEmpty()
  items: BookingItemDto[];

  @IsString()
  @IsOptional()
  promoCode?: string;

  @IsNumber()
  @IsOptional()
  travelFee?: number;
}

export class CancelBookingDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateBookingDto) {
    return this.bookingsService.createBooking(user.sub, dto);
  }

  @Get('my')
  async getMy(@CurrentUser() user: AuthUser): Promise<Record<string, any>[]> {
    return this.bookingsService.getMyBookings(user.sub);
  }

  @Get('provider')
  async getProvider(
    @CurrentUser() user: AuthUser,
  ): Promise<Record<string, any>[]> {
    return this.bookingsService.getProviderBookings(user.sub);
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<Record<string, any>> {
    return this.bookingsService.getBookingById(id);
  }

  @Post(':id/complete')
  async complete(@Param('id') id: string) {
    return this.bookingsService.completeBooking(id);
  }

  @Post(':id/cancel')
  async cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingsService.cancelBooking(id, dto.reason, user.sub);
  }
}
