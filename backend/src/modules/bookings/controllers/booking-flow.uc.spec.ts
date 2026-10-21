import { BadRequestException } from '@nestjs/common';
import { GeocodingController } from '../../geocoding/geocoding.controller';
import { BookingsController } from './bookings.controller';
import { PhotographyHoldsController } from './photography-holds.controller';
import { DisputesController } from '../../disputes/controllers/disputes.controller';

describe('Booking flow direct use-case contracts', () => {
  const customer = { sub: 'customer-1', roles: ['CUSTOMER'] } as any;
  const provider = { sub: 'provider-1', roles: ['PROVIDER'] } as any;
  const create = (service: any) => new BookingsController(service, {} as any);

  it('UC-12 returns the customer booking activity history', async () => {
    const service = { getMyBookings: jest.fn().mockResolvedValue([{ id: 'booking-1' }]) };
    await expect(create(service).getMy(customer)).resolves.toEqual([{ id: 'booking-1' }]);
    expect(service.getMyBookings).toHaveBeenCalledWith('customer-1');
  });

  it('UC-37 retrieves current booking statuses for the customer', async () => {
    const service = { getCustomerBookings: jest.fn().mockResolvedValue([{ id: 'booking-1', status: 'CONFIRMED' }]) };
    await create(service).getMyBookings(customer);
    expect(service.getCustomerBookings).toHaveBeenCalledWith('customer-1');
  });

  it('UC-38 submits an allowed photography location change', async () => {
    const service = { requestPhotographyLocationChange: jest.fn().mockResolvedValue({ status: 'PENDING' }) };
    const body = { address: 'Đại Nội Huế', latitude: 16.469, longitude: 107.578, note: 'Đổi điểm chụp' };
    await create(service).requestPhotographyLocationChange(customer, 'booking-1', 'schedule-1', body);
    expect(service.requestPhotographyLocationChange).toHaveBeenCalledWith('booking-1', 'schedule-1', 'customer-1', body);
  });

  it('UC-38 rejects a location-change resolution without a boolean decision', async () => {
    const controller = create({ resolvePhotographyLocationChange: jest.fn() });
    await expect(controller.resolvePhotographyLocationChange(provider, 'booking-1', 'schedule-1', {} as any)).rejects.toThrow('approved must be a boolean.');
  });

  it('UC-40 returns booking details using caller identity and roles', async () => {
    const service = { getBookingById: jest.fn().mockResolvedValue({ id: 'booking-1', status: 'CONFIRMED' }) };
    await create(service).getById(customer, 'booking-1');
    expect(service.getBookingById).toHaveBeenCalledWith('booking-1', 'customer-1', ['CUSTOMER']);
  });

  it('UC-41 geocodes a valid destination for route navigation', async () => {
    const service = { search: jest.fn().mockResolvedValue([{ display_name: 'Đại Nội Huế', lat: '16.469', lon: '107.578' }]) };
    const controller = new GeocodingController(service as any);
    await controller.search('  Đại Nội Huế  ');
    expect(service.search).toHaveBeenCalledWith('Đại Nội Huế');
  });

  it('UC-41 rejects an empty or one-character navigation query', () => {
    const controller = new GeocodingController({ search: jest.fn() } as any);
    expect(() => controller.search('H')).toThrow(BadRequestException);
  });

  it('UC-42 creates an idempotent photographer booking hold', async () => {
    const service = { createHold: jest.fn().mockResolvedValue({ bookingId: 'booking-photo-1', status: 'PENDING_PAYMENT' }) };
    const controller = new PhotographyHoldsController(service as any);
    const dto = { photographyPackageId: 'package-1', shootDate: '2026-10-20', shootTimeSlot: '09:00-11:00', shootLocation: 'Huế' } as any;
    await controller.createHold(customer, dto, 'photo-hold-1');
    expect(service.createHold).toHaveBeenCalledWith('customer-1', dto, 'photo-hold-1');
  });

  it('UC-42 requires an idempotency key before holding the photographer slot', async () => {
    const controller = new PhotographyHoldsController({ createHold: jest.fn() } as any);
    await expect(controller.createHold(customer, {} as any, undefined)).rejects.toThrow(BadRequestException);
  });

  it('UC-43 creates an Ao Dai rental booking', async () => {
    const service = { createProductBooking: jest.fn().mockResolvedValue({ id: 'booking-rental-1' }) };
    const dto = { productId: 'product-1', rentalFrom: '2026-10-20', rentalTo: '2026-10-22', size: 'M', color: 'RED', quantity: 1 } as any;
    await create(service).createProduct(customer, dto);
    expect(service.createProductBooking).toHaveBeenCalledWith('customer-1', dto);
  });

  it('UC-44 updates booking progress with provider evidence', async () => {
    const service = { updateBookingStatus: jest.fn().mockResolvedValue({ status: 'IN_PROGRESS' }) };
    const body = { status: 'IN_PROGRESS', note: 'Bắt đầu buổi chụp', evidencePhotos: ['https://cdn.test/start.jpg'] };
    await create(service).updateStatus(provider, 'booking-1', body);
    expect(service.updateBookingStatus).toHaveBeenCalledWith('booking-1', 'IN_PROGRESS', 'Bắt đầu buổi chụp', 'provider-1', ['PROVIDER'], undefined, undefined, undefined, ['https://cdn.test/start.jpg']);
  });

  it('UC-44 rejects status updates without a target status', async () => {
    const controller = create({ updateBookingStatus: jest.fn() });
    await expect(controller.updateStatus(provider, 'booking-1', {} as any)).rejects.toThrow(BadRequestException);
  });

  it('UC-39 lets a provider submit an incident report with booking evidence', async () => {
    const service = { createIncidentReport: jest.fn().mockResolvedValue({ id: 'incident-1', status: 'OPEN' }) };
    const controller = new DisputesController(service as any, {} as any);
    const dto = { bookingId: 'booking-1', description: 'Missing accessory', evidencePhotos: ['private://evidence/photo.jpg'] } as any;

    await expect(controller.createIncident(provider, dto)).resolves.toEqual({ id: 'incident-1', status: 'OPEN' });
    expect(service.createIncidentReport).toHaveBeenCalledWith('provider-1', dto);
  });

  it('UC-39 rejects incident creation by a customer account', async () => {
    const controller = new DisputesController({ createIncidentReport: jest.fn() } as any, {} as any);
    await expect(controller.createIncident(customer, {} as any)).rejects.toThrow('Chỉ nhà cung cấp mới có quyền tạo báo cáo sự cố');
  });

  it('UC-45 accepts a booking request through the provider status workflow', async () => {
    const service = { updateBookingStatus: jest.fn().mockResolvedValue({ status: 'CONFIRMED' }) };
    await create(service).updateStatus(provider, 'booking-1', { status: 'CONFIRMED', note: 'Đã kiểm tra lịch' });
    expect(service.updateBookingStatus).toHaveBeenCalledWith('booking-1', 'CONFIRMED', 'Đã kiểm tra lịch', 'provider-1', ['PROVIDER'], undefined, undefined, undefined, undefined);
  });

  it('UC-45 rejects a booking request with the provider reason', async () => {
    const service = { updateBookingStatus: jest.fn().mockResolvedValue({ status: 'CANCELLED' }) };
    await create(service).updateStatus(provider, 'booking-1', { status: 'CANCELLED', note: 'Khung giờ đã kín' });
    expect(service.updateBookingStatus).toHaveBeenCalledWith('booking-1', 'CANCELLED', 'Khung giờ đã kín', 'provider-1', ['PROVIDER'], undefined, undefined, undefined, undefined);
  });

  it('UC-46 cancels a booking with caller roles and the supplied reason', async () => {
    const service = { cancelBooking: jest.fn().mockResolvedValue({ status: 'CANCELLED' }) };
    await create(service).cancel(customer, 'booking-1', { reason: 'Thay đổi kế hoạch' });
    expect(service.cancelBooking).toHaveBeenCalledWith('booking-1', 'customer-1', ['CUSTOMER'], 'Thay đổi kế hoạch');
  });

  it('UC-47 submits a booking reschedule request for the selected item', async () => {
    const service = { rescheduleBooking: jest.fn().mockResolvedValue({ status: 'PENDING' }) };
    const body = { itemId: 'item-1', newShootDate: '2026-10-25', newShootTimeSlot: '14:00-16:00', reason: 'Đổi lịch cá nhân' };
    await create(service).reschedule(customer, 'booking-1', body);
    expect(service.rescheduleBooking).toHaveBeenCalledWith('booking-1', 'customer-1', body);
  });

  it('UC-47 rejects a reschedule request without itemId', async () => {
    const controller = create({ rescheduleBooking: jest.fn() });
    await expect(controller.reschedule(customer, 'booking-1', {} as any)).rejects.toThrow('Thiếu trường itemId');
  });

  it('UC-44 completes a booking using the provider identity and roles', async () => {
    const service = { completeBooking: jest.fn().mockResolvedValue({ status: 'AWAITING_REVIEW' }) };
    await create(service).complete(provider, 'booking-1');
    expect(service.completeBooking).toHaveBeenCalledWith('booking-1', 'provider-1', ['PROVIDER']);
  });
});
