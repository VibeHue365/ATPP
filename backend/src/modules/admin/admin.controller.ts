import { Controller, Get, Patch, Param, UseGuards, ForbiddenException, NotFoundException, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { User, UserStatus } from '../users/schemas/user.schema';
import { Booking, BookingStatus } from '../bookings/schemas/booking.schema';
import { Provider, ProviderCapability } from '../providers/schemas/provider.schema';
import {
  ProviderVerification,
  VerificationStatus,
  VerificationType,
} from '../providers/schemas/provider-verification.schema';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('ADMIN')
@Permissions('dashboard:read')
export class AdminController {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<Booking>,
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
    @InjectModel(ProviderVerification.name)
    private readonly providerVerificationModel: Model<ProviderVerification>,
  ) {}

  private checkAdmin(user: AuthUser) {
    const roles = user.roles || [];
    if (!roles.includes('ADMIN') && !roles.includes('admin')) {
      throw new ForbiddenException('Bạn không có quyền truy cập chức năng Admin');
    }
  }

  private async getActiveProviderApplicantUserIds() {
    return this.providerVerificationModel.distinct('userId', {
      verificationType: VerificationType.NewProvider,
      status: {
        $in: [
          VerificationStatus.Submitted,
          VerificationStatus.UnderReview,
          VerificationStatus.NeedsChanges,
        ],
      },
    });
  }

  @Get('stats')
  async getStats(@CurrentUser() user: AuthUser) {
    this.checkAdmin(user);

    const activeProviderApplicantUserIds =
      await this.getActiveProviderApplicantUserIds();

    const totalCustomers = await this.userModel.countDocuments({
      roles: { $all: ['CUSTOMER'], $nin: ['PROVIDER', 'ADMIN', 'admin'] },
      deletedAt: null,
      ...(activeProviderApplicantUserIds.length > 0
        ? { _id: { $nin: activeProviderApplicantUserIds } }
        : {}),
    });

    const totalProviders = await this.providerModel.countDocuments({
      capabilities: { $in: [ProviderCapability.AoDaiRental, 'RENTAL' as any] },
    });

    const totalBookings = await this.bookingModel.countDocuments({
      status: { $ne: BookingStatus.Draft }
    });

    const completedBookings = await this.bookingModel.find({
      status: { $in: [BookingStatus.Completed, BookingStatus.Confirmed] },
    });
    const totalRevenue = completedBookings.reduce(
      (sum, b) => sum + (b.pricingSummary?.grandTotal || 0),
      0,
    );

    // 1. Group completed bookings by week (last 7 days)
    const revenueByWeek: { month: string; revenue: number }[] = [];
    const now = new Date();
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const label = `${dayNames[d.getDay()]} (${d.getDate()}/${d.getMonth() + 1})`;
      revenueByWeek.push({ month: label, revenue: 0 });
    }

    for (const b of completedBookings) {
      const bDate = (b as any).createdAt ? new Date((b as any).createdAt) : null;
      if (bDate) {
        const mLabel = `${dayNames[bDate.getDay()]} (${bDate.getDate()}/${bDate.getMonth() + 1})`;
        const dayObj = revenueByWeek.find(d => d.month === mLabel);
        if (dayObj) {
          dayObj.revenue += b.pricingSummary?.grandTotal || 0;
        }
      }
    }

    // 2. Group completed bookings by month (last 6 months)
    const revenueByMonth: { month: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = `${d.getMonth() + 1}/${d.getFullYear().toString().slice(-2)}`;
      revenueByMonth.push({ month: label, revenue: 0 });
    }

    for (const b of completedBookings) {
      const bDate = (b as any).createdAt ? new Date((b as any).createdAt) : null;
      if (bDate) {
        const mLabel = `${bDate.getMonth() + 1}/${bDate.getFullYear().toString().slice(-2)}`;
        const monthObj = revenueByMonth.find(m => m.month === mLabel);
        if (monthObj) {
          monthObj.revenue += b.pricingSummary?.grandTotal || 0;
        }
      }
    }

    // 3. Group completed bookings by year (last 10 years)
    const revenueByYear: { month: string; revenue: number }[] = [];
    const currentYear = now.getFullYear();
    for (let i = 9; i >= 0; i--) {
      const label = `${currentYear - i}`;
      revenueByYear.push({ month: label, revenue: 0 });
    }

    for (const b of completedBookings) {
      const bDate = (b as any).createdAt ? new Date((b as any).createdAt) : null;
      if (bDate) {
        const yLabel = `${bDate.getFullYear()}`;
        const yearObj = revenueByYear.find(y => y.month === yLabel);
        if (yearObj) {
          yearObj.revenue += b.pricingSummary?.grandTotal || 0;
        }
      }
    }

    return {
      totalCustomers,
      totalProviders,
      totalBookings,
      totalRevenue,
      revenueByWeek,
      revenueByMonth,
      revenueByYear,
    };
  }

  @Get('customers')
  async getCustomers(
    @CurrentUser() user: AuthUser,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    this.checkAdmin(user);

    const activeProviderApplicantUserIds =
      await this.getActiveProviderApplicantUserIds();

    const filter = {
      roles: { $all: ['CUSTOMER'], $nin: ['PROVIDER', 'ADMIN', 'admin'] },
      accountStatus: { $ne: UserStatus.PendingEmailVerification },
      deletedAt: null,
      ...(activeProviderApplicantUserIds.length > 0
        ? { _id: { $nin: activeProviderApplicantUserIds } }
        : {}),
    };

    const total = await this.userModel.countDocuments(filter);
    const customers = await this.userModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const items = customers.map(c => ({
      id: c._id,
      fullName: c.profile?.fullName || 'Khách hàng',
      avatarUrl: c.profile?.avatarUrl || '',
      email: c.auth?.email || '',
      phone: c.auth?.phone || '',
      gender: c.profile?.gender || 'N/A',
      accountStatus: c.accountStatus || 'ACTIVE',
      createdAt: (c as any).createdAt,
    }));

    return {
      items,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    };
  }

  @Get('providers')
  async getProviders(
    @CurrentUser() user: AuthUser,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    this.checkAdmin(user);

    const filter = {
      capabilities: { $in: [ProviderCapability.AoDaiRental, 'RENTAL' as any] },
    };

    const total = await this.providerModel.countDocuments(filter);
    const providers = await this.providerModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const items = providers.map(p => ({
      id: p._id,
      businessName: p.businessName,
      email: p.contact?.email || '',
      phone: p.contact?.phone || '',
      city: p.address?.city || '',
      addressLine: p.address?.addressLine || '',
      status: p.status || 'PENDING_APPROVAL',
      createdAt: (p as any).createdAt,
    }));

    return {
      items,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    };
  }

  @Patch('customers/:id/ban')
  @Permissions('user:manage')
  async banCustomer(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    this.checkAdmin(user);
    const customer = await this.userModel.findById(id);
    if (!customer) {
      throw new NotFoundException('Không tìm thấy khách hàng');
    }
    customer.accountStatus = UserStatus.Banned;
    await customer.save();
    return { success: true, accountStatus: customer.accountStatus };
  }

  @Patch('customers/:id/unban')
  @Permissions('user:manage')
  async unbanCustomer(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    this.checkAdmin(user);
    const customer = await this.userModel.findById(id);
    if (!customer) {
      throw new NotFoundException('Không tìm thấy khách hàng');
    }
    customer.accountStatus = UserStatus.Active;
    await customer.save();
    return { success: true, accountStatus: customer.accountStatus };
  }
}
