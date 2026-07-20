import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException, UnsupportedMediaTypeException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
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
import { PublicMediaService } from '../../storage/services/public-media.service';

export class CancelBookingDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

@Controller(['bookings', 'api/bookings'])
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly publicMedia: PublicMediaService,
  ) {}

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
      storage: memoryStorage(),
    }),
  )
  async uploadReferenceFile(
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const upload = await this.publicMedia.uploadImage('bookings', file);
    return { url: upload.url };
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
  async getById(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string
  ): Promise<Record<string, any>> {
    return this.bookingsService.getBookingById(id, user.sub, user.roles);
  }

  /** POST /bookings/:id/complete */
  @Post(':id/complete')
  async complete(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string
  ) {
    return this.bookingsService.completeBooking(id, user.sub, user.roles);
  }

  /**
   * POST /bookings/:id/confirm-complete
   * Customer xác nhận hài lòng sau buổi chụp ảnh.
   * Chỉ hoạt động khi booking ở trạng thái AWAITING_REVIEW và caller là customer của booking.
   */
  @Post(':id/confirm-complete')
  async confirmComplete(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.bookingsService.confirmCompleteByCustomer(id, user.sub);
  }

  /** PATCH /bookings/:id/status — Provider cập nhật trạng thái đơn hàng */
  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { status: string; note?: string; handoverPhotos?: string[] },
  ) {
    if (!body?.status) throw new BadRequestException('Thiếu trường status');
    return this.bookingsService.updateBookingStatus(id, body.status, body.note, user.sub, user.roles, body.handoverPhotos);
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

  /** PATCH /bookings/:id/reschedule — Khách hàng đổi lịch đơn hàng (UC-E06) */
  @Patch(':id/reschedule')
  async reschedule(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: {
      itemId: string;
      newRentalFrom?: string;
      newRentalTo?: string;
      newShootDate?: string;
      newShootTimeSlot?: string;
      reason?: string;
    },
  ) {
    if (!body?.itemId) throw new BadRequestException('Thiếu trường itemId');
    return this.bookingsService.rescheduleBooking(id, user.sub, body);
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

  /** GET /bookings/stock/product/:productId/summary */
  @Get('stock/product/:productId/summary')
  async getProductStockSummary(@Param('productId') productId: string) {
    return this.bookingsService.getProductStockSummary(productId);
  }

  /** GET /bookings/stock/product/:productId */
  @Get('stock/product/:productId')
  async getProductStock(
    @Param('productId') productId: string,
    @Query('size') size: string,
    @Query('color') color: string,
  ) {
    if (!size || !color) {
      throw new BadRequestException('size and color queries are required');
    }
    return this.bookingsService.getProductStockCount(productId, size, color);
  }

  @Post(':id/customer-confirm-pickup')
  async customerConfirmPickup(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingsService.customerConfirmPickup(id, user.sub);
  }

  @Post(':id/customer-report-damage')
  async customerReportDamage(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { description: string; evidencePhotos: string[] },
  ) {
    return this.bookingsService.customerReportDamage(
      id,
      user.sub,
      body.description,
      body.evidencePhotos,
    );
  }

  @Post(':id/customer-reject-handover')
  async customerRejectHandover(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { reason: string; evidencePhotos: string[] },
  ) {
    return this.bookingsService.customerRejectHandover(
      id,
      user.sub,
      body.reason,
      body.evidencePhotos,
    );
  }
}
