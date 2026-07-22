import { Injectable } from '@nestjs/common';
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
    private readonly analyticsService: AnalyticsService,
  ) {}

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
      successfulPayments,
      popularBookings,
      topProductsByBookings,
      topSearches,
      registrationGrowth,
      revenueGrowth,
      bookingGrowth,
      totalBookings,
    ] = await Promise.all([
      this.userModel.countDocuments(customerFilter as any),
      this.userModel.countDocuments({ ...customerFilter, accountStatus: 'ACTIVE' } as any),
      this.userModel.countDocuments({ ...customerFilter, accountStatus: 'BANNED' } as any),
      this.providerModel.countDocuments({ capabilities: ProviderCapability.AoDaiRental } as any),
      this.productModel.countDocuments({ status: 'ACTIVE' } as any),
      this.providerModel.countDocuments({ capabilities: 'PHOTOGRAPHY' } as any),
      this.bookingModel.countDocuments({ bookingType: { $in: ['PHOTOGRAPHY', 'COMBO'] } } as any),
      this.paymentModel.find({
        status: { $in: [PaymentStatus.Success, 'SUCCESS', 'PAID'] },
        purpose: { $in: [PaymentPurpose.DepositPayment, PaymentPurpose.RemainingPayment, PaymentPurpose.FullPayment] }
      } as any).select('amount'),
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
    ]);

    const totalRevenue = successfulPayments.reduce((sum, p) => sum + p.amount, 0);
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
    const total = await this.userModel.countDocuments(filter as any);
    const customers = await this.userModel.find(filter as any)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const items = await Promise.all(
      customers.map(async (c) => {
        const bookingsCount = await this.bookingModel.countDocuments({ customerId: c._id });
        return {
          id: c._id.toString(),
          fullName: c.profile?.fullName || 'Khách hàng',
          email: c.auth?.email || '',
          phone: c.auth?.phone || '',
          avatar: c.profile?.avatarUrl || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
          status: c.accountStatus || 'ACTIVE',
          date: (c as any).createdAt ? new Date((c as any).createdAt).toLocaleDateString('vi-VN') : '2026-01-01',
          bookings: bookingsCount,
          spent: 0,
        };
      })
    );

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getAllProviders(page = 1, limit = 10) {
    const total = await this.providerModel.countDocuments({} as any);
    const providers = await this.providerModel.find({} as any)
      .populate('userId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const items = await Promise.all(
      providers.map(async (p) => {
        const userObj = p.userId as any;
        const providerId = p._id;
        const userId = userObj?._id;

        const totalProducts = await this.productModel.countDocuments({
          $or: [
            { providerId: providerId },
            ...(userId ? [{ providerId: userId }] : []),
          ],
        });

        let walletEarned = p.wallet?.totalEarned || p.wallet?.availableBalance || 0;
        if (walletEarned === 0) {
          const completedBookings = await this.bookingModel.find({
            providerIds: providerId,
            status: BookingStatus.Completed,
          } as any);
          walletEarned = completedBookings.reduce((sum, b) => sum + (b.pricingSummary?.grandTotal || 0), 0);
        }

        const ratingVal = p.rating?.averageRating
          ? Number(p.rating.averageRating.toFixed(1))
          : 0;

        return {
          id: p._id.toString(),
          businessName: p.businessName,
          ownerName: userObj?.profile?.fullName || 'Chưa cập nhật',
          email: p.contact?.email || userObj?.auth?.email || '',
          phone: p.contact?.phone || userObj?.auth?.phone || '',
          capability: p.capabilities || [],
          status: p.status || 'ACTIVE',
          totalProducts,
          rating: ratingVal,
          totalEarnings: walletEarned,
        };
      })
    );

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getAllBookings(page = 1, limit = 10) {
    const total = await this.bookingModel.countDocuments({} as any);
    const bookings = await this.bookingModel.find({} as any)
      .populate('customerId')
      .populate('providerIds')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const items = bookings.map(b => {
      const custObj = b.customerId as any;
      const provObj = (b.providerIds && b.providerIds.length > 0) ? (b.providerIds[0] as any) : null;
      return {
        id: b.bookingCode || b._id.toString(),
        bookingId: b._id.toString(),
        customerName: custObj?.profile?.fullName || 'Khách hàng',
        providerName: provObj?.businessName || 'Nhà cung cấp',
        items: b.bookingType || 'Sản phẩm',
        price: b.pricingSummary?.grandTotal || 0,
        deposit: b.pricingSummary?.depositTotal || 0,
        status: b.status || 'PENDING',
        rentalDate: (b as any).createdAt ? new Date((b as any).createdAt).toLocaleDateString('vi-VN') : '2026-01-01',
        returnDate: (b as any).updatedAt ? new Date((b as any).updatedAt).toLocaleDateString('vi-VN') : '2026-01-01',
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

  async getAllTransactions(page = 1, limit = 10) {
    // Query SettlementTransfer (actual payouts to providers) instead of Payment (customer payments)
    const transferModel = this.bookingModel.db.model('SettlementTransfer');
    const total = await transferModel.countDocuments({});
    const transfers = await transferModel.find({})
      .populate('bookingId')
      .populate('providerId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

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

  private async getCustomerGrowth(period = 'month') {
    const growth = [];
    const customerFilter = {
      $and: [
        { roles: 'CUSTOMER' },
        { roles: { $nin: ['ADMIN', 'admin', 'PROVIDER'] } }
      ]
    };

    if (period === 'week') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
        const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

        const count = await this.userModel.countDocuments({
          ...customerFilter,
          createdAt: { $gte: start, $lte: end }
        } as any);

        growth.push({
          label: `${d.getDate()}/${d.getMonth() + 1}`,
          value: count
        });
      }
    } else if (period === 'year') {
      const currentYear = new Date().getFullYear();
      for (let i = 4; i >= 0; i--) {
        const year = currentYear - i;
        const start = new Date(year, 0, 1, 0, 0, 0, 0);
        const end = new Date(year, 11, 31, 23, 59, 59, 999);

        const count = await this.userModel.countDocuments({
          ...customerFilter,
          createdAt: { $gte: start, $lte: end }
        } as any);

        growth.push({
          label: `${year}`,
          value: count
        });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

        const count = await this.userModel.countDocuments({
          ...customerFilter,
          createdAt: { $gte: start, $lte: end }
        } as any);

        growth.push({
          label: `Thg ${d.getMonth() + 1}`,
          value: count
        });
      }
    }
    return growth;
  }

  private async getRevenueGrowth(period = 'month') {
    const growth = [];

    if (period === 'week') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
        const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

        const payments = await this.paymentModel.find({
          status: { $in: [PaymentStatus.Success, 'SUCCESS', 'PAID'] },
          purpose: { $ne: PaymentPurpose.DepositRefund },
          createdAt: { $gte: start, $lte: end }
        } as any);

        const total = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

        growth.push({
          label: `${d.getDate()}/${d.getMonth() + 1}`,
          value: total
        });
      }
    } else if (period === 'year') {
      const currentYear = new Date().getFullYear();
      for (let i = 4; i >= 0; i--) {
        const year = currentYear - i;
        const start = new Date(year, 0, 1, 0, 0, 0, 0);
        const end = new Date(year, 11, 31, 23, 59, 59, 999);

        const payments = await this.paymentModel.find({
          status: { $in: [PaymentStatus.Success, 'SUCCESS', 'PAID'] },
          purpose: { $ne: PaymentPurpose.DepositRefund },
          createdAt: { $gte: start, $lte: end }
        } as any);

        const total = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

        growth.push({
          label: `${year}`,
          value: total
        });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

        const payments = await this.paymentModel.find({
          status: { $in: [PaymentStatus.Success, 'SUCCESS', 'PAID'] },
          purpose: { $ne: PaymentPurpose.DepositRefund },
          createdAt: { $gte: start, $lte: end }
        } as any);

        const total = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

        growth.push({
          label: `Thg ${d.getMonth() + 1}`,
          value: total
        });
      }
    }
    return growth;
  }

  private async getBookingGrowth(period = 'month') {
    const growth = [];

    if (period === 'week') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
        const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

        const count = await this.bookingModel.countDocuments({
          createdAt: { $gte: start, $lte: end }
        } as any);

        growth.push({
          label: `${d.getDate()}/${d.getMonth() + 1}`,
          value: count
        });
      }
    } else if (period === 'year') {
      const currentYear = new Date().getFullYear();
      for (let i = 4; i >= 0; i--) {
        const year = currentYear - i;
        const start = new Date(year, 0, 1, 0, 0, 0, 0);
        const end = new Date(year, 11, 31, 23, 59, 59, 999);

        const count = await this.bookingModel.countDocuments({
          createdAt: { $gte: start, $lte: end }
        } as any);

        growth.push({
          label: `${year}`,
          value: count
        });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

        const count = await this.bookingModel.countDocuments({
          createdAt: { $gte: start, $lte: end }
        } as any);

        growth.push({
          label: `Thg ${d.getMonth() + 1}`,
          value: count
        });
      }
    }
    return growth;
  }
}
