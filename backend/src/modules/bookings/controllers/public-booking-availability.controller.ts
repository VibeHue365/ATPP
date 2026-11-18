import { Controller, Get, Param } from '@nestjs/common';
import { BookingsService } from '../services/bookings.service';
import { ParseObjectIdPipe } from '../../../common/pipes/parse-object-id.pipe';

/**
 * Read-only availability data used by public product and photographer pages.
 * These routes intentionally live outside the authenticated controller.
 */
@Controller(['bookings', 'api/bookings'])
export class PublicBookingAvailabilityController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('busy-dates/product/:productId')
  getProductBusyDates(
    @Param('productId', new ParseObjectIdPipe('ID sản phẩm không hợp lệ'))
    productId: string,
  ) {
    return this.bookingsService.getBusySchedulesForProduct(productId);
  }

  @Get('busy-dates/provider/:providerId')
  getProviderBusyDates(
    @Param('providerId', new ParseObjectIdPipe('ID nhà cung cấp không hợp lệ'))
    providerId: string,
  ) {
    return this.bookingsService.getBusySchedulesForProvider(providerId);
  }
}
