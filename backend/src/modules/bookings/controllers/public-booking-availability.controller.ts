import { Controller, Get, Param } from '@nestjs/common';
import { BookingsService } from '../services/bookings.service';

/**
 * Read-only availability data used by public product and photographer pages.
 * These routes intentionally live outside the authenticated controller.
 */
@Controller(['bookings', 'api/bookings'])
export class PublicBookingAvailabilityController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('busy-dates/product/:productId')
  getProductBusyDates(@Param('productId') productId: string) {
    return this.bookingsService.getBusySchedulesForProduct(productId);
  }

  @Get('busy-dates/provider/:providerId')
  getProviderBusyDates(@Param('providerId') providerId: string) {
    return this.bookingsService.getBusySchedulesForProvider(providerId);
  }
}
