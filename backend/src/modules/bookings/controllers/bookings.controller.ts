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

// ─── DTOs ────────────────────────────────────────────────────────────────────

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

export class CreateProductBookingDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  rentalType: 'DAILY' | 'HOURLY';

  @IsString()
  @IsNotEmpty()
  startDate: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsString()
  @IsNotEmpty()
  size: string;

  @IsString()
  @IsNotEmpty()
  color: string;

  @IsNumber()
  @IsOptional()
  quantity?: number;
}

export class CreatePhotographyBookingDto {
  @IsString()
  @IsNotEmpty()
  packageId: string;

  @IsString()
  @IsNotEmpty()
  shootDate: string;

  @IsString()
  @IsNotEmpty()
  shootTimeSlot: string;

  @IsString()
  @IsNotEmpty()
  shootLocation: string;

  @IsString()
  @IsNotEmpty()
  concept: string;

  @IsString()
  @IsOptional()
  customRequests?: string;

  @IsString()
  @IsOptional()
  referenceImage?: string;
}

export class CancelBookingDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

// ─── Controller ───────────────────────────────────────────────────────────────

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /** POST /bookings — tạo booking tổng hợp (kết hợp nhiều items, hỗ trợ mã giảm giá) */
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateBookingDto) {
    return this.bookingsService.createBooking(user.sub, dto);
  }

  /** POST /bookings/product — tạo booking thuê áo dài (theo ngày hoặc theo giờ) */
  @Post('product')
  async createProduct(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProductBookingDto,
  ) {
    return this.bookingsService.createProductBooking(user.sub, dto);
  }

  /** POST /bookings/photography — tạo booking gói chụp ảnh */
  @Post('photography')
  async createPhotography(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePhotographyBookingDto,
  ) {
    return this.bookingsService.createPhotographyBooking(user.sub, dto);
  }

  /** GET /bookings/my — danh sách booking của khách hàng hiện tại */
  @Get('my')
  async getMy(@CurrentUser() user: AuthUser): Promise<Record<string, any>[]> {
    return this.bookingsService.getMyBookings(user.sub);
  }

  /** GET /bookings/provider — danh sách booking của provider hiện tại */
  @Get('provider')
  async getProvider(
    @CurrentUser() user: AuthUser,
  ): Promise<Record<string, any>[]> {
    return this.bookingsService.getProviderBookings(user.sub);
  }

  /** GET /bookings/:id */
  @Get(':id')
  async getById(@Param('id') id: string): Promise<Record<string, any>> {
    return this.bookingsService.getBookingById(id);
  }

  /** POST /bookings/:id/complete — hoàn thành đơn → trigger đối soát thanh toán */
  @Post(':id/complete')
  async complete(@Param('id') id: string) {
    return this.bookingsService.completeBooking(id);
  }

  /** POST /bookings/:id/cancel — hủy đơn → trigger hoàn tiền cọc */
  @Post(':id/cancel')
  async cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingsService.cancelBooking(id, dto.reason, user.sub);
  }
}
