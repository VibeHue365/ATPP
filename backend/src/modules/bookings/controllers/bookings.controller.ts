import { Body, Controller, Get, Param, Patch, Post, UseGuards, UseInterceptors, UploadedFile, BadRequestException, UnsupportedMediaTypeException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
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

  @Post('upload-reference')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          callback(
            new UnsupportedMediaTypeException(
              'Only jpg, png, and webp images are allowed',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          const dest = join(process.cwd(), 'uploads', 'bookings');
          if (!existsSync(dest)) {
            mkdirSync(dest, { recursive: true });
          }
          callback(null, dest);
        },
        filename: (_request, file, callback) => {
          const safeExt = extname(file.originalname).toLowerCase() || '.jpg';
          callback(
            null,
            `ref-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`,
          );
        },
      }),
    }),
  )
  uploadReferenceFile(
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return { url: `/uploads/bookings/${file.filename}` };
  }


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

  /** POST /bookings/:id/complete */
  @Post(':id/complete')
  async complete(@Param('id') id: string) {
    return this.bookingsService.completeBooking(id);
  }

  /** PATCH /bookings/:id/status — Provider cập nhật trạng thái đơn hàng */
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; note?: string },
  ) {
    if (!body?.status) throw new BadRequestException('Thiếu trường status');
    return this.bookingsService.updateBookingStatus(id, body.status, body.note);
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
