import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ReviewsService } from './reviews.service';

type Row = Record<string, any>;

function reportedReview(overrides: Row = {}): Row {
  return {
    _id: new Types.ObjectId(),
    customerId: { _id: new Types.ObjectId() },
    providerId: { _id: new Types.ObjectId(), userId: new Types.ObjectId() },
    bookingId: { _id: new Types.ObjectId(), bookingCode: 'BK-2026' },
    isReported: true,
    reportStatus: 'PENDING',
    isHidden: false,
    historyTimeline: [],
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function populated(result: unknown) {
  const query: Row = {};
  query.populate = jest.fn().mockReturnValue(query);
  query.sort = jest.fn().mockReturnValue(query);
  query.exec = jest.fn().mockResolvedValue(result);
  query.then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return query;
}

function createService(review: Row | null, list: Row[] = []) {
  const reviewModel = {
    findById: jest.fn().mockReturnValue(populated(review)),
    find: jest.fn().mockReturnValue(populated(list)),
  };
  const notificationsService = {
    createNotification: jest.fn().mockResolvedValue(undefined),
  };
  const service = new ReviewsService(
    reviewModel as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    notificationsService as any,
  );
  const updateRating = jest
    .spyOn(service as any, 'updateProviderRating')
    .mockResolvedValue(undefined);
  return { service, reviewModel, notificationsService, updateRating };
}

describe('UC-64 Moderate Content - reported reviews (HuyLDN)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('UT-64 UTCID07 hides a violating review, recalculates the rating and notifies both parties', async () => {
    const review = reportedReview();
    const { service, notificationsService, updateRating } =
      createService(review);

    await expect(
      service.handleReportedReview(
        review._id.toString(),
        'HIDE',
        'Ngôn từ xúc phạm',
      ),
    ).resolves.toMatchObject({
      success: true,
    });

    expect(review).toMatchObject({ isHidden: true, reportStatus: 'RESOLVED' });
    expect(updateRating).toHaveBeenCalledWith(review.providerId);
    expect(notificationsService.createNotification).toHaveBeenCalledTimes(2);
    expect(notificationsService.createNotification.mock.calls[0][0]).toBe(
      review.customerId._id.toString(),
    );
    expect(notificationsService.createNotification.mock.calls[1][0]).toBe(
      review.providerId.userId.toString(),
    );
  });

  it('UT-64 UTCID08 records an admin confirmation of the violation in the history', async () => {
    const review = reportedReview();
    const { service } = createService(review);

    await service.handleReportedReview(
      review._id.toString(),
      'CONFIRM',
      'Spam',
    );

    expect(review.historyTimeline.at(-1)).toMatchObject({
      title: 'Admin xác nhận vi phạm',
      description: 'Spam',
    });
  });

  it('UT-64 UTCID09 dismisses a report, keeps the review visible and notifies only the provider', async () => {
    const review = reportedReview({ isHidden: true });
    const { service, notificationsService, updateRating } =
      createService(review);

    await service.handleReportedReview(
      review._id.toString(),
      'DISMISS',
      'Không vi phạm',
    );

    expect(review).toMatchObject({ isHidden: false, reportStatus: 'RESOLVED' });
    expect(updateRating).not.toHaveBeenCalled();
    expect(notificationsService.createNotification).toHaveBeenCalledTimes(1);
    expect(notificationsService.createNotification.mock.calls[0][0]).toBe(
      review.providerId.userId.toString(),
    );
  });

  it('UT-64 UTCID10 marks a report as under review without notifications', async () => {
    const review = reportedReview();
    const { service, notificationsService } = createService(review);

    await service.handleReportedReview(
      review._id.toString(),
      'UNDER_REVIEW',
      'Đang xác minh',
    );

    expect(review.reportStatus).toBe('UNDER_REVIEW');
    expect(review.save).toHaveBeenCalledTimes(1);
    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });

  it('UT-64 UTCID11 returns not found for a missing review', async () => {
    const { service } = createService(null);

    await expect(
      service.handleReportedReview(new Types.ObjectId().toString(), 'HIDE'),
    ).rejects.toThrow(new NotFoundException('Không tìm thấy đánh giá'));
  });

  it('UT-64 UTCID12 uses the default moderation reason when the reason is blank', async () => {
    const review = reportedReview();
    const { service } = createService(review);

    await service.handleReportedReview(review._id.toString(), 'HIDE', '   ');

    expect(review.historyTimeline.at(-1).description).toBe(
      'Xử lý bởi quản trị viên hệ thống',
    );
  });

  it('UT-64 UTCID13 summarizes the reported-review queue by moderation state', async () => {
    const { service, reviewModel } = createService(null, [
      reportedReview({ reportStatus: undefined }),
      reportedReview({ reportStatus: 'PENDING' }),
      reportedReview({ reportStatus: 'UNDER_REVIEW' }),
      reportedReview({ reportStatus: 'RESOLVED', isHidden: true }),
      reportedReview({ reportStatus: 'DISMISSED' }),
    ]);

    const result = await service.getReportedReviewsForAdmin();

    expect(reviewModel.find).toHaveBeenCalledWith({ isReported: true });
    expect(result.metrics).toEqual({
      total: 5,
      pending: 2,
      underReview: 1,
      resolved: 2,
      hidden: 1,
    });
  });

  it('UT-64 UTCID14 rejects a malformed review id', async () => {
    const { service, reviewModel } = createService(reportedReview());

    await expect(
      service.handleReportedReview('review-1', 'HIDE'),
    ).rejects.toThrow();
    expect(reviewModel.findById).not.toHaveBeenCalled();
  });
});
