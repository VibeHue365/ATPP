import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Provider, ProviderDocument, ProviderCapability } from '../providers/schemas/provider.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Booking, BookingDocument, BookingStatus } from '../bookings/schemas/booking.schema';
import { BookingItem, BookingItemDocument } from '../bookings/schemas/booking-item.schema';
import { Payment, PaymentDocument, PaymentStatus, PaymentPurpose } from '../payments/schemas/payment.schema';
import { RefreshToken } from '../auth/schemas/refresh-token.schema';
import { AnalyticsService } from '../analytics/services/analytics.service';
import {
  ProviderVerification,
  ProviderVerificationDocument,
  VerificationStatus,
} from '../providers/schemas/provider-verification.schema';
import {
  Dispute,
  DisputeDocument,
  DisputeStatus,
} from '../disputes/schemas/dispute.schema';
import { Review, ReviewDocument } from '../reviews/schemas/review.schema';

@Injectable()
export class AdminStatsService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Provider.name) private readonly providerModel: Model<ProviderDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(BookingItem.name) private readonly bookingItemModel: Model<BookingItemDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(RefreshToken.name) private readonly refreshTokenModel: Model<RefreshToken>,
    @InjectModel(ProviderVerification.name)
    private readonly providerVerificationModel: Model<ProviderVerificationDocument>,
    @InjectModel(Dispute.name)
    private readonly disputeModel: Model<DisputeDocument>,
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>,
    private readonly analyticsService: AnalyticsService,
  ) { }

  async getAdminStats(period = 'month') {
    const customerFilter = {
      $and: [
        { roles: 'CUSTOMER' },
        { roles: { $nin: ['ADMIN', 'admin', 'PROVIDER'] } }
      ]
    };

    const [
      totalCustomers,
      activeCustomers,
      bannedCustomers,
      totalShops,
      activeProducts,
      totalPhotographers,
      totalPhotoBookings,
      revenueTotals,
      popularBookings,
      topProductsByBookings,
      topSearches,
      registrationGrowth,
      revenueGrowth,
      bookingGrowth,
      totalBookings,
      pendingVerifications,
      openDisputes,
    ] = await Promise.all([
      this.userModel.countDocuments(customerFilter as any),
      this.userModel.countDocuments({ ...customerFilter, accountStatus: 'ACTIVE' } as any),
      this.userModel.countDocuments({ ...customerFilter, accountStatus: 'BANNED' } as any),
      this.providerModel.countDocuments({ capabilities: ProviderCapability.AoDaiRental } as any),
      this.productModel.countDocuments({ status: 'ACTIVE' } as any),
      this.providerModel.countDocuments({ capabilities: 'PHOTOGRAPHY' } as any),
      this.bookingModel.countDocuments({ bookingType: { $in: ['PHOTOGRAPHY', 'COMBO'] } } as any),
      this.paymentModel.aggregate<{ total: number }>([
        {
          $match: {
            status: { $in: [PaymentStatus.Success, 'SUCCESS', 'PAID'] },
            purpose: {
              $in: [
                PaymentPurpose.DepositPayment,
                PaymentPurpose.RemainingPayment,
                PaymentPurpose.FullPayment,
              ],
            },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      this.bookingModel.aggregate([
        { $match: { status: { $ne: 'CANCELLED' } } },
        { $group: { _id: '$bookingType', count: { $sum: 1 } } }
      ]),
      this.bookingItemModel.aggregate([
        { $match: { productId: { $ne: null } } },
        { $group: { _id: '$productId', count: { $sum: { $ifNull: ['$quantity', 1] } } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: false } }
      ]).catch(() => []),
      this.analyticsService.getTopSearches(10),
      this.getCustomerGrowth(period),
      this.getRevenueGrowth(period),
      this.getBookingGrowth(period),
      this.bookingModel.countDocuments({} as any),
      this.providerVerificationModel.countDocuments({
        status: { $in: [VerificationStatus.Submitted, VerificationStatus.UnderReview] },
      }),
      this.disputeModel.countDocuments({
        status: { $in: [DisputeStatus.Open, DisputeStatus.UnderReview] },
      }),
    ]);

    const totalRevenue = revenueTotals[0]?.total ?? 0;
    const platformCommission = totalRevenue * 0.10;

    const popularProducts = topProductsByBookings.length > 0
      ? topProductsByBookings.map((r: any) => ({
        _id: r._id.toString(),
        name: r.product.name,
        basePrice: r.product.basePrice,
        viewCount: 0,
        rentCount: r.count
      }))
      : (await this.productModel.find({ status: 'ACTIVE' } as any).limit(5).select('name basePrice')).map(p => ({
        _id: p._id.toString(),
        name: p.name,
        basePrice: p.basePrice,
        viewCount: 0,
        rentCount: 0
      }));

    const topProductIds = popularProducts.map(p => new Types.ObjectId(p._id));
    const viewCountMap = await this.analyticsService.getViewCountMap(topProductIds);
    const popularProductsWithViews = popularProducts.map(p => ({
      ...p,
      viewCount: viewCountMap.get(p._id) ?? 0,
    }));

    const userBehavior = {
      topSearches,
      pageViews: {
        homepage: totalCustomers * 6,
        rentals: totalCustomers * 4,
        photographers: totalPhotographers * 3,
        productDetails: activeProducts * 5
      },
      popularBookings,
      popularProducts: popularProductsWithViews
    };

    return {
      customers: {
        total: totalCustomers,
        active: activeCustomers,
        banned: bannedCustomers,
        growth: registrationGrowth
      },
      shops: {
        total: totalShops,
        activeProducts: activeProducts
      },
      photographers: {
        total: totalPhotographers,
        bookings: totalPhotoBookings
      },
      revenue: {
        total: totalRevenue,
        commission: platformCommission,
        growth: revenueGrowth
      },
      bookings: {
        total: totalBookings,
        growth: bookingGrowth
      },
      operational: {
        pendingVerifications,
        openDisputes,
      },
      userBehavior
    };
  }

  async getAllCustomers(page = 1, limit = 10) {
    const filter = {
      $and: [
        { roles: 'CUSTOMER' },
        { roles: { $nin: ['ADMIN', 'admin', 'PROVIDER'] } }
      ]
    };
    const [total, customers] = await Promise.all([
      this.userModel.countDocuments(filter as any),
      this.userModel.find(filter as any)
        .select('profile auth.email auth.phone accountStatus createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const customerIds = customers.map((customer) => customer._id);
    const bookingCounts = customerIds.length > 0
      ? await this.bookingModel.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { customerId: { $in: customerIds } } },
        { $group: { _id: '$customerId', count: { $sum: 1 } } },
      ])
      : [];
    const bookingCountByCustomer = new Map(
      bookingCounts.map((entry) => [entry._id.toString(), entry.count]),
    );

    const customerFallbackAvatars = [
      '/avatar_mai_anh.webp',
      '/avatar_minh_tam.webp',
      '/avatar_hanna.webp',
      '/hoang_minh.webp',
      '/lam_ngoc.webp',
      '/tran_bao.webp',
      '/le_thao.webp',
    ];

    const items = customers.map((customer: any, idx: number) => {
      let avatarUrl = customer.profile?.avatarUrl;
      if (!avatarUrl || avatarUrl.includes('unsplash.com') || avatarUrl.includes('example.com')) {
        avatarUrl = customerFallbackAvatars[idx % customerFallbackAvatars.length];
      }
      return {
        id: customer._id.toString(),
        fullName: customer.profile?.fullName || 'Khách hàng',
        email: customer.auth?.email || '',
        phone: customer.auth?.phone || '',
        avatar: avatarUrl,
        status: customer.accountStatus || 'ACTIVE',
        date: customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('vi-VN') : '2026-01-01',
        bookings: bookingCountByCustomer.get(customer._id.toString()) ?? 0,
        spent: 0,
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getAllProviders(page = 1, limit = 10) {
    const [total, providers] = await Promise.all([
      this.providerModel.countDocuments({} as any),
      this.providerModel.find({} as any)
        .select('userId businessName contact capabilities status rating wallet createdAt media address paymentAccounts taxCode')
        .populate('userId', 'profile.fullName profile.avatarUrl auth.email auth.phone')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const providerIds = providers.map((provider: any) => provider._id);
    const legacyUserIds = providers
      .map((provider: any) => provider.userId?._id)
      .filter((id: Types.ObjectId | undefined): id is Types.ObjectId => Boolean(id));

    const [productList, bookingStats, verificationsList, reviewsList] = providerIds.length > 0
      ? await Promise.all([
        this.productModel.find({
          providerId: { $in: [...providerIds, ...legacyUserIds] },
        })
          .select('providerId name basePrice images status')
          .lean(),
        this.bookingModel.aggregate<{
          _id: Types.ObjectId;
          totalRevenue: number;
          completedCount: number;
          totalCount: number;
        }>([
          { $match: { providerIds: { $in: providerIds } } },
          { $unwind: '$providerIds' },
          { $match: { providerIds: { $in: providerIds } } },
          {
            $group: {
              _id: '$providerIds',
              totalRevenue: {
                $sum: {
                  $cond: [{ $eq: ['$status', BookingStatus.Completed] }, '$pricingSummary.grandTotal', 0],
                },
              },
              completedCount: {
                $sum: {
                  $cond: [{ $eq: ['$status', BookingStatus.Completed] }, 1, 0],
                },
              },
              totalCount: { $sum: 1 },
            },
          },
        ]),
        this.providerVerificationModel.find({
          $or: [
            { providerId: { $in: providerIds } },
            { userId: { $in: legacyUserIds } },
          ],
        })
          .select('providerId userId status verificationType')
          .lean(),
        this.reviewModel.find({
          providerId: { $in: providerIds },
        })
          .populate('customerId', 'profile.fullName profile.avatarUrl')
          .sort({ createdAt: -1 })
          .select('providerId customerId rating comment createdAt')
          .lean(),
      ])
      : [[], [], [], []];

    const productsByProvider = new Map<string, any[]>();
    for (const p of productList) {
      const key = p.providerId?.toString();
      if (key) {
        const existing = productsByProvider.get(key) || [];
        existing.push(p);
        productsByProvider.set(key, existing);
      }
    }

    const bookingStatsMap = new Map<string, { totalRevenue: number; completedCount: number; totalCount: number }>();
    for (const b of bookingStats) {
      bookingStatsMap.set(b._id.toString(), b);
    }

    const verificationMap = new Map<string, any>();
    for (const v of verificationsList) {
      if (v.providerId) verificationMap.set(v.providerId.toString(), v);
      if (v.userId) verificationMap.set(v.userId.toString(), v);
    }

    const reviewsByProvider = new Map<string, any[]>();
    for (const r of reviewsList) {
      const key = r.providerId?.toString();
      if (key) {
        const existing = reviewsByProvider.get(key) || [];
        existing.push(r);
        reviewsByProvider.set(key, existing);
      }
    }

    const fallbackAvatars = [
      '/hoang_minh.webp',
      '/avatar_hanna.webp',
      '/lam_ngoc.webp',
      '/avatar_mai_anh.webp',
      '/tran_bao.webp',
      '/avatar_minh_tam.webp',
      '/le_thao.webp',
    ];

    const items = providers.map((provider: any, idx: number) => {
      const user = provider.userId;
      const providerKey = provider._id.toString();
      const userKey = user?._id?.toString();
      const storedEarnings = provider.wallet?.totalEarned || provider.wallet?.availableBalance || 0;
      let avatarUrl = provider.media?.logoUrl || user?.profile?.avatarUrl;
      if (!avatarUrl || avatarUrl.includes('unsplash.com') || avatarUrl.includes('example.com')) {
        avatarUrl = fallbackAvatars[idx % fallbackAvatars.length];
      }

      const bStat = bookingStatsMap.get(providerKey) || { totalRevenue: 0, completedCount: 0, totalCount: 0 };
      const prodList = [...(productsByProvider.get(providerKey) || []), ...(userKey ? productsByProvider.get(userKey) || [] : [])];
      const revList = reviewsByProvider.get(providerKey) || [];
      const verif = verificationMap.get(providerKey) || (userKey ? verificationMap.get(userKey) : null);

      const isVerified = verif?.status === VerificationStatus.Approved || verif?.status === 'APPROVED' || provider.status === 'ACTIVE';

      const fullAddress = provider.address
        ? [provider.address.addressLine, provider.address.ward, provider.address.district, provider.address.city].filter(Boolean).join(', ')
        : 'Chưa cập nhật';

      const defaultPayment = provider.paymentAccounts?.find((acc: any) => acc.isDefault) || provider.paymentAccounts?.[0];
      const realTaxCode = provider.taxCode || verif?.businessLicense?.licenseNumber || verif?.identityCard?.cardNumber || '';

      return {
        id: providerKey,
        businessName: provider.businessName,
        ownerName: user?.profile?.fullName || 'Chưa cập nhật',
        avatar: avatarUrl,
        email: provider.contact?.email || user?.auth?.email || '',
        phone: provider.contact?.phone || user?.auth?.phone || '',
        website: provider.contact?.website || '',
        address: fullAddress,
        capability: provider.capabilities || [],
        status: provider.status || 'ACTIVE',
        taxCode: realTaxCode,
        bankAccount: defaultPayment?.accountNumberMasked || 'Chưa liên kết',
        bankName: defaultPayment?.bankName || 'Chưa liên kết',
        createdAt: provider.createdAt ? new Date(provider.createdAt).toLocaleDateString('vi-VN') : '',
        totalProducts: prodList.length,
        completedBookings: bStat.completedCount,
        totalBookings: bStat.totalCount,
        completionRate: bStat.totalCount > 0 ? Math.round((bStat.completedCount / bStat.totalCount) * 100) : 100,
        rating: provider.rating?.averageRating ? Number(provider.rating.averageRating.toFixed(1)) : 0,
        totalEarnings: storedEarnings || bStat.totalRevenue || 0,
        isVerified,
        hasIdCard: Boolean(verif?.identityCard?.cardNumber || isVerified),
        hasBusinessLicense: Boolean(verif?.businessLicense?.licenseNumber || isVerified),
        hasStudioProof: Boolean(verif?.shopPhotos?.length || verif?.portfolioProof?.length || isVerified),
        products: prodList.map((p: any) => ({
          id: p._id.toString(),
          name: p.name,
          price: p.basePrice,
          image: p.images?.[0] || '',
          status: p.status || 'ACTIVE',
        })),
        reviews: revList.map((r: any) => ({
          id: r._id.toString(),
          customerName: r.customerId?.profile?.fullName || 'Khách hàng',
          avatar: r.customerId?.profile?.avatarUrl || '',
          rating: r.rating,
          comment: r.comment,
          date: r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : '',
        })),
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getAllBookings(
    page = 1,
    limit = 10,
    search?: string,
    statusFilter?: string,
    bookingTypeFilter?: string,
    cityFilter?: string,
    startDate?: string,
    endDate?: string,
  ) {
    // 1. Calculate overall real metrics across all bookings in MongoDB
    const [allBookingsSummary, allDisputes] = await Promise.all([
      this.bookingModel.find({}, 'status createdAt').lean(),
      this.disputeModel.find({}, 'bookingId reason status adminDecision createdAt').lean(),
    ]);

    const totalAll = allBookingsSummary.length;
    const pendingCount = allBookingsSummary.filter((b: any) =>
      ['PENDING_PAYMENT', 'DRAFT', 'AWAITING_REVIEW'].includes(b.status),
    ).length;
    const upcomingCount = allBookingsSummary.filter((b: any) =>
      ['CONFIRMED', 'DEPOSIT_PAID', 'PICKUP_PENDING', 'IN_PROGRESS', 'PICKED_UP'].includes(b.status),
    ).length;
    const completedCount = allBookingsSummary.filter((b: any) =>
      ['COMPLETED', 'RETURNED'].includes(b.status),
    ).length;
    const cancelledCount = allBookingsSummary.filter((b: any) =>
      ['CANCELLED'].includes(b.status),
    ).length;

    const disputeBookingIdSet = new Set(
      allDisputes.map((d: any) => d.bookingId?.toString()).filter(Boolean),
    );
    const disputedCount = allBookingsSummary.filter((b: any) =>
      ['DISPUTED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(b.status) ||
      disputeBookingIdSet.has(b._id.toString()),
    ).length;

    const totalSafe = totalAll || 1;
    const pendingPct = ((pendingCount / totalSafe) * 100).toFixed(0);
    const upcomingPct = ((upcomingCount / totalSafe) * 100).toFixed(0);
    const completedPct = ((completedCount / totalSafe) * 100).toFixed(0);
    const cancelledPct = ((cancelledCount / totalSafe) * 100).toFixed(0);
    const disputedPct = ((disputedCount / totalSafe) * 100).toFixed(0);

    const metrics = {
      total: totalAll,
      pendingConfirmation: pendingCount,
      upcoming: upcomingCount,
      completed: completedCount,
      cancelled: cancelledCount,
      disputedOrRefund: disputedCount,
      trends: {
        total: `${totalAll} đơn toàn hệ thống`,
        pendingConfirmation: `${pendingPct}% trên tổng số`,
        upcoming: `${upcomingPct}% trên tổng số`,
        completed: `${completedPct}% trên tổng số`,
        cancelled: `${cancelledPct}% trên tổng số`,
        disputedOrRefund: `${disputedPct}% trên tổng số`,
      },
    };

    // 2. Build filtered query
    const filter: any = {};

    if (statusFilter && statusFilter !== 'ALL' && statusFilter !== 'Tất cả') {
      if (statusFilter === 'PENDING' || statusFilter === 'Chờ xác nhận') {
        filter.status = { $in: ['PENDING_PAYMENT', 'DRAFT', 'AWAITING_REVIEW'] };
      } else if (statusFilter === 'UPCOMING' || statusFilter === 'Sắp diễn ra') {
        filter.status = { $in: ['CONFIRMED', 'DEPOSIT_PAID', 'PICKUP_PENDING', 'IN_PROGRESS', 'PICKED_UP'] };
      } else if (statusFilter === 'COMPLETED' || statusFilter === 'Đã hoàn thành') {
        filter.status = { $in: ['COMPLETED', 'RETURNED'] };
      } else if (statusFilter === 'CANCELLED' || statusFilter === 'Đã hủy') {
        filter.status = 'CANCELLED';
      } else if (statusFilter === 'DISPUTED' || statusFilter === 'Có tranh chấp') {
        const disputeIds = Array.from(disputeBookingIdSet).map(id => new Types.ObjectId(id));
        filter.$or = [
          { status: { $in: ['DISPUTED', 'PARTIALLY_REFUNDED', 'REFUNDED'] } },
          { _id: { $in: disputeIds } },
        ];
      } else {
        filter.status = statusFilter;
      }
    }

    if (bookingTypeFilter && bookingTypeFilter !== 'ALL' && bookingTypeFilter !== 'Tất cả') {
      if (bookingTypeFilter === 'Thuê áo dài' || bookingTypeFilter === 'AODAI_RENTAL') {
        filter.bookingType = 'AODAI_RENTAL';
      } else if (bookingTypeFilter === 'Chụp ảnh' || bookingTypeFilter === 'PHOTOGRAPHY') {
        filter.bookingType = 'PHOTOGRAPHY';
      } else if (bookingTypeFilter === 'Combo' || bookingTypeFilter === 'COMBO') {
        filter.bookingType = 'COMBO';
      } else {
        filter.bookingType = bookingTypeFilter;
      }
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    // Customer / Provider search if specified
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      const [matchingUsers, matchingProviders] = await Promise.all([
        this.userModel.find({
          $or: [
            { 'profile.fullName': regex },
            { 'auth.phone': regex },
            { 'auth.email': regex },
          ],
        }, '_id').lean(),
        this.providerModel.find({
          businessName: regex,
        }, '_id').lean(),
      ]);

      const userIds = matchingUsers.map(u => u._id);
      const provIds = matchingProviders.map(p => p._id);

      const searchOr: any[] = [
        { bookingCode: regex },
      ];
      if (userIds.length > 0) searchOr.push({ customerId: { $in: userIds } });
      if (provIds.length > 0) searchOr.push({ providerIds: { $in: provIds } });

      if (filter.$or) {
        filter.$and = [
          { $or: filter.$or },
          { $or: searchOr },
        ];
        delete filter.$or;
      } else {
        filter.$or = searchOr;
      }
    }

    const [total, bookings] = await Promise.all([
      this.bookingModel.countDocuments(filter),
      this.bookingModel.find(filter)
        .populate('customerId', 'profile auth')
        .populate('providerIds', 'businessName contact address media')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const bookingIds = bookings.map((b: any) => b._id);

    const [bookingItems, disputes] = bookingIds.length > 0
      ? await Promise.all([
        this.bookingItemModel.find({ bookingId: { $in: bookingIds } })
          .populate('productId', 'name images basePrice')
          .lean(),
        this.disputeModel.find({ bookingId: { $in: bookingIds } }).lean(),
      ])
      : [[], []];

    const itemsByBookingId = new Map<string, any[]>();
    for (const item of bookingItems) {
      const bId = (item as any).bookingId?.toString();
      if (bId) {
        const list = itemsByBookingId.get(bId) || [];
        list.push(item);
        itemsByBookingId.set(bId, list);
      }
    }

    const disputeByBookingId = new Map<string, any>();
    for (const d of disputes) {
      const bId = (d as any).bookingId?.toString();
      if (bId) {
        disputeByBookingId.set(bId, d);
      }
    }

    const items = bookings.map((b: any) => {
      const custObj = b.customerId as any;
      const provObj = (b.providerIds && b.providerIds.length > 0) ? (b.providerIds[0] as any) : null;
      const bItems = itemsByBookingId.get(b._id.toString()) || [];
      const disp = disputeByBookingId.get(b._id.toString());

      const customerAvatar = custObj?.profile?.avatarUrl || '';
      let customerPhone = custObj?.auth?.phone || 'Chưa cập nhật';
      if (customerPhone.startsWith('+84')) {
        customerPhone = '0' + customerPhone.slice(3);
      }

      let providerPhone = provObj?.contact?.phone || 'Chưa cập nhật';
      if (providerPhone.startsWith('+84')) {
        providerPhone = '0' + providerPhone.slice(3);
      }

      // Determine schedule datetime
      let scheduleDate = '—';
      let scheduleTime = '—';
      const firstItem = bItems[0];
      if (firstItem?.rentalFrom) {
        const d = new Date(firstItem.rentalFrom);
        scheduleDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        scheduleTime = firstItem.rentalType === 'HOURLY' ? 'Theo giờ' : 'Theo ngày';
      } else if (firstItem?.shootDate) {
        const d = new Date(firstItem.shootDate);
        scheduleDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        scheduleTime = firstItem.shootTimeSlot || 'Theo lịch hẹn';
      } else if (b.createdAt) {
        const d = new Date(b.createdAt);
        scheduleDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        scheduleTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }

      // Determine issue
      let issueText = '—';
      if (disp) {
        const rLower = (disp.reason || '').toLowerCase();
        if (rLower.includes('hoàn tiền') || disp.status === 'REFUNDED') {
          issueText = 'Yêu cầu hoàn tiền';
        } else {
          issueText = 'Khách khiếu nại';
        }
      } else if (['DISPUTED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(b.status)) {
        issueText = b.status === 'DISPUTED' ? 'Khách khiếu nại' : 'Yêu cầu hoàn tiền';
      }

      // Determine payment status
      const isPaid = b.paymentSummary?.paymentStatus === 'PAID' ||
        ['COMPLETED', 'RETURNED'].includes(b.status) ||
        (b.pricingSummary?.grandTotal > 0 && b.paymentSummary?.totalPaid >= b.pricingSummary?.grandTotal);

      // Status translation
      let statusLabel = 'Sắp diễn ra';
      if (['COMPLETED', 'RETURNED'].includes(b.status)) {
        statusLabel = 'Đã hoàn thành';
      } else if (['PENDING_PAYMENT', 'DRAFT', 'AWAITING_REVIEW'].includes(b.status)) {
        statusLabel = 'Chờ xác nhận';
      } else if (b.status === 'CANCELLED') {
        statusLabel = 'Đã hủy';
      } else if (['DISPUTED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(b.status) || disp) {
        statusLabel = 'Có tranh chấp';
      }

      // Service label
      let serviceLabel = 'Thuê áo dài';
      if (b.bookingType === 'PHOTOGRAPHY') {
        serviceLabel = 'Chụp ảnh';
      } else if (b.bookingType === 'COMBO') {
        serviceLabel = 'Combo';
      } else if (firstItem?.itemType === 'PHOTOGRAPHY_PACKAGE') {
        serviceLabel = 'Chụp ảnh';
      }

      const rawCity = provObj?.address?.city || '';
      const cleanCity = rawCity ? rawCity.replace(/^Thành phố\s+/i, '').replace(/^Tỉnh\s+/i, '') : 'Chưa cập nhật';

      const customerFullName = custObj?.profile?.fullName || custObj?.auth?.email || 'Khách hàng';
      const providerBusinessName = provObj?.businessName || 'Chưa liên kết';
      const custCode = custObj?._id ? `#KH${custObj._id.toString().slice(-6).toUpperCase()}` : '—';
      const provCode = provObj?._id ? `#DT${provObj._id.toString().slice(-5).toUpperCase()}` : '—';

      const specsList = [];
      if (firstItem?.selectedColor) specsList.push(`Màu ${firstItem.selectedColor}`);
      if (firstItem?.selectedSize) specsList.push(`Size ${firstItem.selectedSize}`);
      const specsText = specsList.length > 0 ? specsList.join(' - ') : (firstItem?.customizationNotes || 'Tiêu chuẩn');

      const fullProvAddress = [provObj?.address?.addressLine, provObj?.address?.ward, provObj?.address?.district, provObj?.address?.city].filter(Boolean).join(', ') || cleanCity;

      return {
        id: b.bookingCode || b._id.toString(),
        bookingCode: b.bookingCode || `BK${b._id.toString().slice(-7).toUpperCase()}`,
        bookingId: b._id.toString(),
        customerName: customerFullName,
        providerName: providerBusinessName,
        items: serviceLabel,
        price: b.pricingSummary?.grandTotal || 0,
        deposit: b.pricingSummary?.depositTotal || 0,
        status: b.status || 'CONFIRMED',
        statusLabel,
        rentalDate: scheduleDate,
        returnDate: (b as any).updatedAt ? new Date((b as any).updatedAt).toLocaleDateString('vi-VN') : scheduleDate,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        isPaid,
        issue: issueText,
        schedule: {
          date: scheduleDate,
          time: scheduleTime,
        },
        customer: {
          id: custObj?._id?.toString() || '',
          code: custCode,
          fullName: customerFullName,
          phone: customerPhone,
          email: custObj?.auth?.email || 'Chưa cập nhật',
          avatar: customerAvatar,
          address: custObj?.profile?.address?.fullAddress || custObj?.profile?.address?.city || 'Chưa cập nhật',
        },
        provider: {
          id: provObj?._id?.toString() || '',
          code: provCode,
          businessName: providerBusinessName,
          phone: providerPhone,
          city: cleanCity,
          fullAddress: fullProvAddress,
          avatar: provObj?.media?.logoUrl || provObj?.media?.avatarUrl || '',
        },
        serviceDetails: {
          name: firstItem?.productId?.name || (serviceLabel === 'Chụp ảnh' ? 'Dịch vụ chụp ảnh' : 'Dịch vụ áo dài'),
          package: firstItem?.rentalType === 'HOURLY' ? 'Gói thuê theo giờ' : firstItem?.rentalType === 'DAILY' ? 'Gói thuê theo ngày' : serviceLabel,
          specs: specsText,
          image: firstItem?.productId?.images?.[0] || firstItem?.referenceImage || '',
          location: firstItem?.shootLocation || firstItem?.pickupReturnLocationSnapshot?.address || cleanCity,
          guests: serviceLabel === 'Chụp ảnh' ? '1 - 2 người' : '1 người',
        },
        financials: {
          total: b.pricingSummary?.grandTotal || 0,
          paid: isPaid ? (b.pricingSummary?.grandTotal || 0) : (b.paymentSummary?.totalPaid || b.pricingSummary?.depositTotal || 0),
          refunded: b.paymentSummary?.totalRefunded || (disp?.adminDecision?.refundAmount || 0),
          disputesCount: disp ? 1 : 0,
        },
        timeline: b.statusTimeline && b.statusTimeline.length > 0 ? b.statusTimeline : [
          { status: 'DRAFT', changedAt: b.createdAt, note: 'Khách tạo đơn đặt lịch' },
          { status: b.status, changedAt: b.updatedAt || b.createdAt, note: 'Cập nhật trạng thái' },
        ],
        customerNotes: b.pickupDamageReport?.description || b.cancellation?.reason || '',
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      metrics,
    };
  }

  async getAllTransactions(page = 1, limit = 10) {
    // Query SettlementTransfer (actual payouts to providers) instead of Payment (customer payments)
    const transferModel = this.bookingModel.db.model('SettlementTransfer');
    const [total, transfers] = await Promise.all([
      transferModel.countDocuments({}),
      transferModel.find({})
        .select('transactionReference bookingId providerId amountSent destinationBankAccount status createdAt')
        .populate('bookingId', 'bookingCode')
        .populate('providerId', 'businessName')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const items = transfers.map((t: any) => {
      const bookingObj = t.bookingId as any;
      const provObj = t.providerId as any;
      return {
        id: t.transactionReference || t._id.toString(),
        bookingId: bookingObj?._id || '',
        bookingCode: bookingObj?.bookingCode || '',
        providerName: provObj?.businessName || 'Nhà cung cấp',
        amount: t.amountSent || 0,
        date: t.createdAt ? new Date(t.createdAt).toLocaleDateString('vi-VN') : '',
        bank: t.destinationBankAccount?.bankName || 'Ngân hàng',
        account: t.destinationBankAccount?.accountNumber || '*********',
        status: t.status === 'SUCCESS' ? 'PAID' : t.status === 'PENDING' ? 'PENDING' : 'FAILED',
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async banCustomer(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    await this.userModel.updateOne(
      { _id: userObjectId } as any,
      { $set: { accountStatus: 'BANNED' } }
    );
    // Revoke all active sessions immediately so the user is kicked out
    await this.refreshTokenModel.updateMany(
      { userId: userObjectId },
      { $set: { revokedAt: new Date() } }
    );
    return { success: true, message: 'Khách hàng đã bị khóa tài khoản và đăng xuất khỏi hệ thống' };
  }

  async unbanCustomer(userId: string) {
    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) } as any,
      { $set: { accountStatus: 'ACTIVE' } }
    );
    return { success: true, message: 'Khách hàng đã được mở khóa tài khoản' };
  }

  private periodBuckets(period = 'month') {
    const now = new Date();
    const buckets: Array<{ key: string; label: string; start: Date; end: Date }> = [];

    if (period === 'week') {
      for (let offset = 6; offset >= 0; offset -= 1) {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
        buckets.push({
          key: this.dateKey(date),
          label: `${date.getDate()}/${date.getMonth() + 1}`,
          start: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          end: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999),
        });
      }
      return { buckets, format: '%Y-%m-%d' };
    }

    if (period === 'year') {
      for (let offset = 4; offset >= 0; offset -= 1) {
        const year = now.getFullYear() - offset;
        buckets.push({
          key: String(year),
          label: String(year),
          start: new Date(year, 0, 1),
          end: new Date(year, 11, 31, 23, 59, 59, 999),
        });
      }
      return { buckets, format: '%Y' };
    }

    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      buckets.push({
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        label: `Thg ${date.getMonth() + 1}`,
        start: date,
        end: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999),
      });
    }
    return { buckets, format: '%Y-%m' };
  }

  private dateKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private async getCustomerGrowth(period = 'month') {
    const { buckets, format } = this.periodBuckets(period);
    const rows = await this.userModel.aggregate<{ _id: string; value: number }>([
      {
        $match: {
          roles: 'CUSTOMER',
          $and: [{ roles: { $nin: ['ADMIN', 'admin', 'PROVIDER'] } }],
          createdAt: { $gte: buckets[0].start, $lte: buckets[buckets.length - 1].end },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format, date: '$createdAt', timezone: 'Asia/Bangkok' } },
          value: { $sum: 1 },
        },
      },
    ]);
    const values = new Map(rows.map((row) => [row._id, row.value]));
    return buckets.map(({ key, label }) => ({ label, value: values.get(key) ?? 0 }));
  }

  private async getRevenueGrowth(period = 'month') {
    const { buckets, format } = this.periodBuckets(period);
    const rows = await this.paymentModel.aggregate<{ _id: string; value: number }>([
      {
        $match: {
          status: { $in: [PaymentStatus.Success, 'SUCCESS', 'PAID'] },
          purpose: {
            $in: [
              PaymentPurpose.DepositPayment,
              PaymentPurpose.RemainingPayment,
              PaymentPurpose.FullPayment,
            ],
          },
          createdAt: { $gte: buckets[0].start, $lte: buckets[buckets.length - 1].end },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format, date: '$createdAt', timezone: 'Asia/Bangkok' } },
          value: { $sum: '$amount' },
        },
      },
    ]);
    const values = new Map(rows.map((row) => [row._id, row.value]));
    return buckets.map(({ key, label }) => ({ label, value: values.get(key) ?? 0 }));
  }

  private async getBookingGrowth(period = 'month') {
    const { buckets, format } = this.periodBuckets(period);
    const rows = await this.bookingModel.aggregate<{ _id: string; value: number }>([
      {
        $match: {
          createdAt: { $gte: buckets[0].start, $lte: buckets[buckets.length - 1].end },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format, date: '$createdAt', timezone: 'Asia/Bangkok' } },
          value: { $sum: 1 },
        },
      },
    ]);
    const values = new Map(rows.map((row) => [row._id, row.value]));
    return buckets.map(({ key, label }) => ({ label, value: values.get(key) ?? 0 }));
  }

  async updateBookingStatus(id: string, status: string, note?: string) {
    let booking: any = null;
    if (Types.ObjectId.isValid(id)) {
      booking = await this.bookingModel.findById(id);
    }
    if (!booking) {
      booking = await this.bookingModel.findOne({
        $or: [{ bookingId: id }, { code: id }]
      });
    }
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn booking');
    }
    booking.status = status as any;
    if (note) {
      if (!booking.notes) booking.notes = [];
      (booking.notes as any).push({
        content: `Quản trị viên cập nhật trạng thái: ${status}. Ghi chú: ${note}`,
        createdAt: new Date(),
      });
    }
    await booking.save();
    return { success: true, bookingId: booking._id, status: booking.status };
  }
}
