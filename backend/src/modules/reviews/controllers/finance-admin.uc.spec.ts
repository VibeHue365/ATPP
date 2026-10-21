import { ForbiddenException } from '@nestjs/common';
import { AdminStatsController } from '../../admin-stats/admin-stats.controller';
import { PaymentsController } from '../../payments/controllers/payments.controller';
import { ReviewsController } from './reviews.controller';
import { RefundsController } from '../../payments/controllers/refunds.controller';
import { AdminUsersController } from '../../users/controllers/admin-users.controller';
import { AdminSystemPoliciesController } from '../../system-policies/controllers/admin-system-policies.controller';
import { DisputesController } from '../../disputes/controllers/disputes.controller';

describe('Finance, review and Admin direct use-case contracts', () => {
  const customer = { sub: 'customer-1', roles: ['CUSTOMER'] } as any;
  const provider = { sub: 'provider-1', roles: ['PROVIDER'] } as any;
  const admin = { sub: 'admin-1', roles: ['ADMIN'] } as any;

  const paymentController = (service: any) => new PaymentsController(
    service,
    { get: jest.fn().mockReturnValue('test') } as any,
    {} as any,
    {} as any,
  );

  it('UC-48 returns only the caller transaction history', async () => {
    const service = { getTransactions: jest.fn().mockResolvedValue([{ paymentCode: 'PAY-1' }]) };
    await paymentController(service).getHistory(customer);
    expect(service.getTransactions).toHaveBeenCalledWith('customer-1', ['CUSTOMER']);
  });

  it('UC-49 creates an online payment link for a booking and purpose', async () => {
    const service = { createPaymentLink: jest.fn().mockResolvedValue({ checkoutUrl: 'https://pay.test/PAY-1' }) };
    const dto = { bookingId: 'booking-1', purpose: 'DEPOSIT_PAYMENT' } as any;
    await paymentController(service).createLink(customer, dto);
    expect(service.createPaymentLink).toHaveBeenCalledWith('booking-1', 'DEPOSIT_PAYMENT', 'customer-1');
  });

  it('UC-49 checks payment status using the authenticated customer', async () => {
    const service = { getPaymentStatus: jest.fn().mockResolvedValue({ status: 'SUCCESS' }) };
    await paymentController(service).getStatus(customer, 'PAY-1');
    expect(service.getPaymentStatus).toHaveBeenCalledWith('PAY-1', 'customer-1');
  });

  it('UC-53 creates a verified service review for a completed booking item', async () => {
    const service = { createReview: jest.fn().mockResolvedValue({ id: 'review-1', rating: 5 }) };
    const controller = new ReviewsController(service as any, {} as any);
    const dto = { bookingId: 'booking-1', bookingItemId: 'item-1', rating: 5, comment: 'Đúng ảnh và đúng giờ' };
    await controller.create(customer, dto);
    expect(service.createReview).toHaveBeenCalledWith('customer-1', dto);
  });

  it('UC-54 lets the provider reply to a review', async () => {
    const service = { replyToReview: jest.fn().mockResolvedValue({ providerReply: 'Cảm ơn bạn' }) };
    const controller = new ReviewsController(service as any, {} as any);
    await controller.reply(provider, 'review-1', { reply: 'Cảm ơn bạn' });
    expect(service.replyToReview).toHaveBeenCalledWith('provider-1', 'review-1', 'Cảm ơn bạn');
  });

  it('UC-55 reports an inappropriate review with a reason', async () => {
    const service = { reportReview: jest.fn().mockResolvedValue({ status: 'REPORTED' }) };
    const controller = new ReviewsController(service as any, {} as any);
    await controller.report('review-1', { reason: 'Spam' });
    expect(service.reportReview).toHaveBeenCalledWith('review-1', 'Spam');
  });

  it('UC-56 retrieves provider review statistics', async () => {
    const service = { getReviewStats: jest.fn().mockResolvedValue({ averageRating: 4.7, totalReviews: 30 }) };
    const controller = new ReviewsController(service as any, {} as any);
    await controller.getStats(provider);
    expect(service.getReviewStats).toHaveBeenCalledWith('provider-1');
  });

  it('UC-64 lets Admin resolve a reported review', async () => {
    const service = { handleReportedReview: jest.fn().mockResolvedValue({ moderationStatus: 'HIDDEN' }) };
    const controller = new ReviewsController(service as any, {} as any);
    await controller.handleReport(admin, 'review-1', { action: 'HIDE', reason: 'Vi phạm nội dung' });
    expect(service.handleReportedReview).toHaveBeenCalledWith('review-1', 'HIDE', 'Vi phạm nội dung');
  });

  it('UC-64 rejects reported-review moderation by a non-Admin actor', async () => {
    const controller = new ReviewsController({ handleReportedReview: jest.fn() } as any, {} as any);
    await expect(controller.handleReport(provider, 'review-1', { action: 'HIDE' })).rejects.toThrow(ForbiddenException);
  });

  it('UC-66 returns the Admin violation/report queue', async () => {
    const service = { getReportedReviewsForAdmin: jest.fn().mockResolvedValue([{ id: 'review-1', reports: 2 }]) };
    const controller = new ReviewsController(service as any, {} as any);
    await controller.getReportedReviews(admin);
    expect(service.getReportedReviewsForAdmin).toHaveBeenCalledTimes(1);
  });

  it('UC-52 returns the Admin transaction-management list', async () => {
    const service = { getAllTransactions: jest.fn().mockResolvedValue({ items: [{ id: 'payment-1' }], total: 1 }) };
    const controller = new AdminStatsController(service as any);
    await controller.getTransactions(admin, 2, 20);
    expect(service.getAllTransactions).toHaveBeenCalledWith(2, 20);
  });

  it('UC-68 returns paginated customer analytics to Admin', async () => {
    const service = { getAllCustomers: jest.fn().mockResolvedValue({ items: [], total: 0 }) };
    const controller = new AdminStatsController(service as any);
    await controller.getCustomers(admin, 1, 10);
    expect(service.getAllCustomers).toHaveBeenCalledWith(1, 10);
  });

  it('UC-69 returns provider/shop analytics to Admin', async () => {
    const service = { getAllProviders: jest.fn().mockResolvedValue({ items: [{ capabilities: ['AO_DAI_RENTAL'] }], total: 1 }) };
    const controller = new AdminStatsController(service as any);
    await controller.getProviders(admin, 1, 10);
    expect(service.getAllProviders).toHaveBeenCalledWith(1, 10);
  });

  it('UC-70 exposes photographer totals in the platform dashboard', async () => {
    const dashboard = { photographers: { total: 12, bookings: 30 } };
    const service = { getAdminStats: jest.fn().mockResolvedValue(dashboard) };
    const controller = new AdminStatsController(service as any);
    await expect(controller.getStats(admin, 'month')).resolves.toEqual(dashboard);
  });

  it('UC-71 exposes gross revenue and commission in the platform dashboard', async () => {
    const dashboard = { revenue: { total: 50000000, commission: 5000000 } };
    const service = { getAdminStats: jest.fn().mockResolvedValue(dashboard) };
    const controller = new AdminStatsController(service as any);
    await expect(controller.getStats(admin, 'year')).resolves.toEqual(dashboard);
    expect(service.getAdminStats).toHaveBeenCalledWith('year');
  });

  it('UC-51 creates an idempotent customer refund request', async () => {
    const service = { createCustomerRequest: jest.fn().mockResolvedValue({ id: 'refund-1', status: 'PENDING' }) };
    const controller = new RefundsController(service as any);
    const dto = { amount: 300000, reason: 'Booking cancelled' } as any;
    await controller.create('booking-1', dto, 'refund-request-1', customer);
    expect(service.createCustomerRequest).toHaveBeenCalledWith('booking-1', 'customer-1', 300000, 'Booking cancelled', 'refund-request-1');
  });

  it('UC-51 rejects a refund request without an idempotency key', () => {
    const controller = new RefundsController({ createCustomerRequest: jest.fn() } as any);
    expect(() => controller.create('booking-1', { amount: 300000, reason: 'Cancelled' } as any, undefined, customer)).toThrow('Idempotency-Key header is required');
  });

  it('UC-51 routes an approved refund amount and version to the workflow', async () => {
    const service = { approve: jest.fn().mockResolvedValue({ status: 'APPROVED' }) };
    const controller = new RefundsController(service as any);
    const dto = { amount: 250000, expectedVersion: 2, reason: 'Evidence accepted' } as any;
    await controller.approve('refund-1', dto, admin);
    expect(service.approve).toHaveBeenCalledWith('refund-1', 'admin-1', 250000, 2, 'Evidence accepted');
  });

  it('UC-63 locks a managed account with request audit metadata', async () => {
    const service = { adminLockUser: jest.fn().mockResolvedValue({ status: 'LOCKED' }) };
    const controller = new AdminUsersController(service as any);
    const dto = { reason: 'Policy violation' } as any;
    const request = { ip: '127.0.0.1', headers: { 'user-agent': 'jest' } };
    await controller.lock(admin, 'user-1', dto, request);
    expect(service.adminLockUser).toHaveBeenCalledWith('admin-1', 'user-1', dto, { ipAddress: '127.0.0.1', userAgent: 'jest' });
  });

  it('UC-63 updates account roles with the exact Admin request context', async () => {
    const service = { adminUpdateRoles: jest.fn().mockResolvedValue({ roles: ['CUSTOMER', 'PROVIDER'] }) };
    const controller = new AdminUsersController(service as any);
    const dto = { roles: ['CUSTOMER', 'PROVIDER'] } as any;
    const request = { ip: '127.0.0.1', headers: { 'user-agent': ['jest', 'proxy'] } };
    await controller.updateRoles(admin, 'user-1', dto, request);
    expect(service.adminUpdateRoles).toHaveBeenCalledWith('admin-1', 'user-1', dto, { ipAddress: '127.0.0.1', userAgent: 'jest' });
  });

  it('UC-66 returns the Admin dispute queue', async () => {
    const service = { getDisputedIncidents: jest.fn().mockResolvedValue([{ id: 'incident-1' }]) };
    const controller = new DisputesController(service as any, {} as any);
    await expect(controller.getDisputedList(admin)).resolves.toEqual([{ id: 'incident-1' }]);
    expect(service.getDisputedIncidents).toHaveBeenCalledTimes(1);
  });

  it('UC-66 rejects an incomplete Admin dispute decision', async () => {
    const controller = new DisputesController({ adminResolveIncident: jest.fn() } as any, {} as any);
    await expect(controller.adminResolve(admin, 'booking-1', { decision: 'REFUND' } as any)).rejects.toThrow('Thiếu thông tin quyết định phán quyết hoặc ghi chú');
  });

  it('UC-67 creates a versioned system policy with Admin audit metadata', async () => {
    const service = { createPolicy: jest.fn().mockResolvedValue({ id: 'policy-1', status: 'DRAFT' }) };
    const controller = new AdminSystemPoliciesController(service as any);
    const dto = { code: 'PLATFORM_FEE', config: { percentage: 10 } } as any;
    const request = { ip: '127.0.0.1', headers: { 'user-agent': 'jest' } };
    await controller.create(admin, dto, request);
    expect(service.createPolicy).toHaveBeenCalledWith('admin-1', dto, { ipAddress: '127.0.0.1', userAgent: 'jest' });
  });

  it('UC-67 activates a selected policy version', async () => {
    const service = { activatePolicy: jest.fn().mockResolvedValue({ id: 'policy-1', status: 'ACTIVE' }) };
    const controller = new AdminSystemPoliciesController(service as any);
    const dto = { reason: 'Approved for release' } as any;
    const request = { ip: '127.0.0.1', headers: { 'user-agent': 'jest' } };
    await controller.activate(admin, 'policy-1', dto, request);
    expect(service.activatePolicy).toHaveBeenCalledWith('admin-1', 'policy-1', dto, { ipAddress: '127.0.0.1', userAgent: 'jest' });
  });
});
