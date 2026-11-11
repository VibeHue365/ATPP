import { Controller, Get, UseGuards, ForbiddenException, Query, Param, Patch, Body, Post } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AdminStatsService } from './admin-stats.service';
import { AdminAiAnalyticsService } from './admin-ai-analytics.service';

@Controller('admin/stats')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('ADMIN')
@Permissions('dashboard:read')
export class AdminStatsController {
  constructor(
    private readonly adminStatsService: AdminStatsService,
    private readonly adminAiAnalyticsService: AdminAiAnalyticsService,
  ) {}

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
    @Query('search') search?: string,
  ) {
    this.checkAdminRole(user);
    return this.adminStatsService.getAllCustomers(+page, +limit, search);
  }

  @Get('providers')
  async getProviders(
    @CurrentUser() user: AuthUser,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
  ) {
    this.checkAdminRole(user);
    return this.adminStatsService.getAllProviders(+page, +limit, search);
  }

  @Get('bookings')
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
  async getTransactions(
    @CurrentUser() user: AuthUser,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    this.checkAdminRole(user);
    return this.adminStatsService.getAllTransactions(+page, +limit);
  }

  @Get('customers/:id/detail')
  async getCustomerDetail(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    this.checkAdminRole(user);
    return this.adminStatsService.getCustomerDetail(id);
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

  @Patch('bookings/:id/status')
  async updateBookingStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('note') note?: string,
  ) {
    this.checkAdminRole(user);
    return this.adminStatsService.updateBookingStatus(id, status, note);
  }

  @Get('ai-analytics')
  async getAiAnalytics(
    @CurrentUser() user: AuthUser,
    @Query('question') question?: string,
  ) {
    this.checkAdminRole(user);
    return this.adminAiAnalyticsService.getAiAnalytics(question);
  }

  @Post('ai-analytics/ask')
  async askAiCopilot(
    @CurrentUser() user: AuthUser,
    @Body('question') question: string,
  ) {
    this.checkAdminRole(user);
    return this.adminAiAnalyticsService.getAiAnalytics(question);
  }

  private checkAdminRole(user: AuthUser) {
    if (!user.roles?.includes('ADMIN') && !user.roles?.includes('admin')) {
      throw new ForbiddenException('Admin role is required to access admin statistics');
    }
  }
}
