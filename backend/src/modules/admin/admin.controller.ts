import { Controller, Get, Patch, Param, UseGuards, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { User, UserStatus } from '../users/schemas/user.schema';
import { Booking, BookingStatus } from '../bookings/schemas/booking.schema';
import { Provider } from '../providers/schemas/provider.schema';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<Booking>,
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
  ) {}

  private checkAdmin(user: AuthUser) {
    const roles = user.roles || [];
    if (!roles.includes('ADMIN') && !roles.includes('admin')) {
      throw new ForbiddenException('Bạn không có quyền truy cập chức năng Admin');
    }
  }

  @Get('stats')
  async getStats(@CurrentUser() user: AuthUser) {
    this.checkAdmin(user);

    const totalCustomers = await this.userModel.countDocuments({
      roles: { $ne: 'PROVIDER' },
      deletedAt: null,
    });

    const totalProviders = await this.providerModel.countDocuments();

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

    return {
      totalCustomers,
      totalProviders,
      totalBookings,
      totalRevenue,
    };
  }

  @Get('customers')
  async getCustomers(@CurrentUser() user: AuthUser) {
    this.checkAdmin(user);

    const customers = await this.userModel.find({
      roles: { $ne: 'PROVIDER' },
      deletedAt: null,
    });

    return customers.map(c => ({
      id: c._id,
      fullName: c.profile?.fullName || 'Khách hàng',
      avatarUrl: c.profile?.avatarUrl || '',
      email: c.auth?.email || '',
      phone: c.auth?.phone || '',
      gender: c.profile?.gender || 'N/A',
      accountStatus: c.accountStatus || 'ACTIVE',
      createdAt: (c as any).createdAt,
    }));
  }

  @Get('providers')
  async getProviders(@CurrentUser() user: AuthUser) {
    this.checkAdmin(user);

    const providers = await this.providerModel.find();
    return providers.map(p => ({
      id: p._id,
      businessName: p.businessName,
      email: p.contact?.email || '',
      phone: p.contact?.phone || '',
      city: p.address?.city || '',
      addressLine: p.address?.addressLine || '',
      status: p.status || 'PENDING_APPROVAL',
      createdAt: (p as any).createdAt,
    }));
  }

  @Patch('customers/:id/ban')
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
