import { Controller, Get, UseGuards, ForbiddenException, Query, Param, Patch } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AdminStatsService } from './admin-stats.service';

@Controller('admin/stats')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('ADMIN')
@Permissions('dashboard:read')
export class AdminStatsController {
  constructor(private readonly adminStatsService: AdminStatsService) {}

  @Get()
  async getStats(
    @CurrentUser() user: AuthUser,
    @Query('period') period = 'month',
  ) {
    this.checkAdminRole(user);
    return this.adminStatsService.getAdminStats(period);
  }

  @Get('customers')
  async getCustomers(
    @CurrentUser() user: AuthUser,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    this.checkAdminRole(user);
    return this.adminStatsService.getAllCustomers(+page, +limit);
  }

  @Get('providers')
  async getProviders(
    @CurrentUser() user: AuthUser,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    this.checkAdminRole(user);
    return this.adminStatsService.getAllProviders(+page, +limit);
  }

  @Get('bookings')
  async getBookings(
    @CurrentUser() user: AuthUser,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    this.checkAdminRole(user);
    return this.adminStatsService.getAllBookings(+page, +limit);
  }

  @Get('transactions')
  async getTransactions(
    @CurrentUser() user: AuthUser,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    this.checkAdminRole(user);
    return this.adminStatsService.getAllTransactions(+page, +limit);
  }

  @Patch('customers/:id/ban')
  @Permissions('user:manage')
  async banCustomer(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    this.checkAdminRole(user);
    return this.adminStatsService.banCustomer(id);
  }

  @Patch('customers/:id/unban')
  @Permissions('user:manage')
  async unbanCustomer(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    this.checkAdminRole(user);
    return this.adminStatsService.unbanCustomer(id);
  }

  private checkAdminRole(user: AuthUser) {
    if (!user.roles?.includes('ADMIN') && !user.roles?.includes('admin')) {
      throw new ForbiddenException('Admin role is required to access admin statistics');
    }
  }
}
