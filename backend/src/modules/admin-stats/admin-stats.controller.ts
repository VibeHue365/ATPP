import { Controller, Get, UseGuards, ForbiddenException, Query, Param, Patch, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AdminStatsService } from './admin-stats.service';

@Controller(['admin/stats', 'admin-stats', 'api/v1/admin-stats'])
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AdminStatsController {
  constructor(private readonly adminStatsService: AdminStatsService) {}

  @Get('rental-bookings')
  @Roles('ADMIN', 'PROVIDER', 'SHOP')
  @Permissions()
  async getRentalBookings(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('shopId') shopId?: string,
    @Query('providerId') providerId?: string,
  ) {
    return this.adminStatsService.getRentalBookings(
      { from: from || startDate, to: to || endDate, shopId, providerId },
      user,
    );
  }

  @Get('top-products')
  @Roles('ADMIN', 'PROVIDER', 'SHOP')
  @Permissions()
  async getTopProducts(
    @CurrentUser() user: AuthUser,
    @Query('shopId') shopId?: string,
    @Query('providerId') providerId?: string,
    @Query('limit') limit?: number,
  ) {
    return this.adminStatsService.getTopProducts(
      { shopId, providerId, limit },
      user,
    );
  }

  @Get('inventory-breakdown')
  @Roles('ADMIN', 'PROVIDER', 'SHOP')
  @Permissions()
  async getInventoryBreakdown(
    @CurrentUser() user: AuthUser,
    @Query('shopId') shopId?: string,
    @Query('providerId') providerId?: string,
  ) {
    return this.adminStatsService.getInventoryBreakdown(
      { shopId, providerId },
      user,
    );
  }

  @Get()
  @Roles('ADMIN')
  @Permissions('dashboard:read')
  async getStats(
    @CurrentUser() user: AuthUser,
    @Query('period') period = 'month',
  ) {
    this.checkAdminRole(user);
    return this.adminStatsService.getAdminStats(period);
  }

  @Get('customers')
  @Roles('ADMIN')
  @Permissions('dashboard:read')
  async getCustomers(
    @CurrentUser() user: AuthUser,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    this.checkAdminRole(user);
    return this.adminStatsService.getAllCustomers(+page, +limit);
  }

  @Get('providers')
  @Roles('ADMIN')
  @Permissions('dashboard:read')
  async getProviders(
    @CurrentUser() user: AuthUser,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    this.checkAdminRole(user);
    return this.adminStatsService.getAllProviders(+page, +limit);
  }

  @Get('bookings')
  @Roles('ADMIN')
  @Permissions('dashboard:read')
  async getBookings(
    @CurrentUser() user: AuthUser,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('bookingType') bookingType?: string,
    @Query('city') city?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    this.checkAdminRole(user);
    return this.adminStatsService.getAllBookings(
      +page,
      +limit,
      search,
      status,
      bookingType,
      city,
      startDate,
      endDate,
    );
  }

  @Get('transactions')
  @Roles('ADMIN')
  @Permissions('dashboard:read')
  async getTransactions(
    @CurrentUser() user: AuthUser,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    this.checkAdminRole(user);
    return this.adminStatsService.getAllTransactions(+page, +limit);
  }

  @Patch('customers/:id/ban')
  @Roles('ADMIN')
  @Permissions('user:manage')
  async banCustomer(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    this.checkAdminRole(user);
    return this.adminStatsService.banCustomer(id);
  }

  @Patch('customers/:id/unban')
  @Roles('ADMIN')
  @Permissions('user:manage')
  async unbanCustomer(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    this.checkAdminRole(user);
    return this.adminStatsService.unbanCustomer(id);
  }

  @Patch('bookings/:id/status')
  @Roles('ADMIN')
  @Permissions('dashboard:read')
  async updateBookingStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('note') note?: string,
  ) {
    this.checkAdminRole(user);
    return this.adminStatsService.updateBookingStatus(id, status, note);
  }

  private checkAdminRole(user: AuthUser) {
    if (!user.roles?.includes('ADMIN') && !user.roles?.includes('admin')) {
      throw new ForbiddenException('Admin role is required to access admin statistics');
    }
  }
}
