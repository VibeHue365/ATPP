import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProvidersRepository } from '../repositories/providers.repository';
import { Product } from '../../products/schemas/product.schema';
import { PhotographyPackage } from '../../products/schemas/photography-package.schema';
import { Booking } from '../../bookings/schemas/booking.schema';
import { BookingItem } from '../../bookings/schemas/booking-item.schema';
import { BookingSchedule } from '../../bookings/schemas/booking-schedule.schema';
import { Review } from '../../reviews/schemas/review.schema';
import { Notification } from '../../notifications/schemas/notification.schema';
import {
  OverviewPeriod,
  OverviewServiceFilter,
  ProviderOverviewQueryDto,
} from '../dto/provider-overview-query.dto';
import {
  ProviderOverviewChartPoint,
  ProviderOverviewKpis,
  ProviderOverviewPerformance,
  ProviderOverviewRecentActivity,
  ProviderOverviewResponse,
  ProviderOverviewScheduleItem,
  ProviderOverviewTask,
  ProviderOverviewTopService,
} from '../dto/provider-overview.response';

const VALID_REVENUE_STATUSES = [
  'DEPOSIT_PAID',
  'CONFIRMED',
  'PICKUP_PENDING',
  'PICKED_UP',
  'RETURN_PENDING',
  'RETURNED',
  'IN_PROGRESS',
  'AWAITING_REVIEW',
  'COMBO_PHOTOS_APPROVED',
  'COMPLETED',
];

interface CacheEntry {
  expiresAt: number;
  data: ProviderOverviewResponse;
}

@Injectable()
export class ProviderOverviewService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly providersRepository: ProvidersRepository,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(PhotographyPackage.name)
    private readonly photographyPackageModel: Model<PhotographyPackage>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<Booking>,
    @InjectModel(BookingItem.name)
    private readonly bookingItemModel: Model<BookingItem>,
    @InjectModel(BookingSchedule.name)
    private readonly bookingScheduleModel: Model<BookingSchedule>,
    @InjectModel(Review.name) private readonly reviewModel: Model<Review>,
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
  ) {}

  public invalidateCache(providerId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${providerId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  async getOverview(
    userIdStr: string,
    query: ProviderOverviewQueryDto,
  ): Promise<ProviderOverviewResponse> {
    const userId = new Types.ObjectId(userIdStr);
    const provider = await this.providersRepository.findByUserId(userId);
    if (!provider) {
      throw new NotFoundException('Không tìm thấy thông tin đối tác');
    }

    const providerId = provider._id;
    const period = query.period || OverviewPeriod.Month;
    const service = query.service || OverviewServiceFilter.All;

    const now = new Date();
    const vnNowParts = this.getVnDateParts(now);

    let targetYear = vnNowParts.year;
    let targetMonth = vnNowParts.month;
    if (query.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(query.month)) {
      const [y, m] = query.month.split('-').map(Number);
      targetYear = y;
      targetMonth = m;
    }
    const padTargetMonth = String(targetMonth).padStart(2, '0');
    const selectedMonth = `${targetYear}-${padTargetMonth}`;
    const selectedMonthLabel = `Tháng ${targetMonth}/${targetYear}`;
    const isCurrentMonth =
      targetYear === vnNowParts.year && targetMonth === vnNowParts.month;

    const cacheKey = `${providerId.toString()}:${period}:${service}:${selectedMonth}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const vnTodayStr = this.formatVnDateKey(now); // YYYY-MM-DD
    const startOfToday = new Date(`${vnTodayStr}T00:00:00+07:00`);
    const endOfToday = new Date(`${vnTodayStr}T23:59:59.999+07:00`);

    const [
      kpis,
      chart,
      upcomingSchedules,
      tasks,
      topServices,
      recentActivities,
      performance,
    ] = await Promise.all([
      this.calculateKpis(
        providerId,
        now,
        startOfToday,
        endOfToday,
        targetYear,
        targetMonth,
        selectedMonth,
        selectedMonthLabel,
        isCurrentMonth,
      ),
      this.calculateChart(
        providerId,
        period,
        service,
        now,
        targetYear,
        targetMonth,
        selectedMonth,
        selectedMonthLabel,
        isCurrentMonth,
      ),
      this.calculateUpcomingSchedules(providerId, startOfToday),
      this.calculateTasks(providerId, provider.userId, startOfToday, endOfToday),
      this.calculateTopServices(providerId),
      this.calculateRecentActivities(providerId),
      this.calculatePerformance(provider, providerId),
    ]);

    const result: ProviderOverviewResponse = {
      generatedAt: now.toISOString(),
      kpis,
      chart,
      upcomingSchedules,
      tasks,
      topServices,
      recentActivities,
      performance,
    };

    this.cache.set(cacheKey, {
      expiresAt: Date.now() + 30_000, // 30s TTL
      data: result,
    });

    return result;
  }

  private async calculateKpis(
    providerId: Types.ObjectId,
    now: Date,
    startOfToday: Date,
    endOfToday: Date,
    targetYear: number,
    targetMonth: number,
    selectedMonth: string,
    selectedMonthLabel: string,
    isCurrentMonth: boolean,
  ): Promise<ProviderOverviewKpis> {
    const padMonth = String(targetMonth).padStart(2, '0');
    const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
    const startOfSelectedMonth = new Date(
      `${targetYear}-${padMonth}-01T00:00:00+07:00`,
    );
    const endOfSelectedMonth = new Date(
      `${targetYear}-${padMonth}-${String(daysInTargetMonth).padStart(2, '0')}T23:59:59.999+07:00`,
    );

    // Preceding month range in VN timezone
    const prevMonthYear = targetMonth === 1 ? targetYear - 1 : targetYear;
    const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1;
    const padPrevMonth = String(prevMonth).padStart(2, '0');
    const daysInPrevMonth = new Date(prevMonthYear, prevMonth, 0).getDate();
    const startOfPrevMonth = new Date(
      `${prevMonthYear}-${padPrevMonth}-01T00:00:00+07:00`,
    );
    const endOfPrevMonth = new Date(
      `${prevMonthYear}-${padPrevMonth}-${String(daysInPrevMonth).padStart(2, '0')}T23:59:59.999+07:00`,
    );

    // 1. Revenue selected month & previous month
    const revenueAggregation = await this.bookingItemModel.aggregate([
      { $match: { providerId } },
      {
        $lookup: {
          from: 'bookings',
          localField: 'bookingId',
          foreignField: '_id',
          as: 'booking',
        },
      },
      { $unwind: '$booking' },
      {
        $match: {
          'booking.status': { $in: VALID_REVENUE_STATUSES },
          'booking.createdAt': {
            $gte: startOfPrevMonth,
            $lte: endOfSelectedMonth,
          },
        },
      },
      {
        $project: {
          netRevenue: {
            $max: [
              0,
              {
                $subtract: [
                  {
                    $multiply: [
                      '$unitPrice',
                      { $ifNull: ['$quantity', 1] },
                    ],
                  },
                  { $ifNull: ['$comboDiscountAmount', 0] },
                ],
              },
            ],
          },
          createdAt: '$booking.createdAt',
        },
      },
    ]);

    let revenueThisMonth = 0;
    let revenueLastMonth = 0;
    for (const item of revenueAggregation) {
      const itemDate = new Date(item.createdAt);
      if (itemDate >= startOfSelectedMonth && itemDate <= endOfSelectedMonth) {
        revenueThisMonth += item.netRevenue || 0;
      } else if (itemDate >= startOfPrevMonth && itemDate <= endOfPrevMonth) {
        revenueLastMonth += item.netRevenue || 0;
      }
    }

    const revenueChangePct =
      revenueLastMonth > 0
        ? Math.round(
            ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100,
          )
        : null;

    // 2. Pending bookings count & oldest pending
    const pendingBookings = await this.bookingModel
      .find({
        providerIds: providerId,
        status: { $in: ['DEPOSIT_PAID'] },
      } as any)
      .select('createdAt')
      .sort({ createdAt: 1 })
      .lean();

    const pendingConfirmCount = pendingBookings.length;
    const oldestPendingAt = (pendingBookings[0] as any)?.createdAt
      ? new Date((pendingBookings[0] as any).createdAt).toISOString()
      : null;

    // 3. Upcoming schedules count (next 7 days) & today
    const in7Days = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingSchedulesCount = await this.bookingScheduleModel.countDocuments({
      providerId,
      status: { $in: ['CONFIRMED', 'SCHEDULED', 'HELD'] },
      $or: [
        { startsAt: { $gte: startOfToday, $lte: in7Days } },
        { scheduledDate: { $gte: startOfToday, $lte: in7Days } },
      ],
    } as any);

    const todaySchedulesCount = await this.bookingScheduleModel.countDocuments({
      providerId,
      status: { $in: ['CONFIRMED', 'SCHEDULED', 'HELD'] },
      $or: [
        { startsAt: { $gte: startOfToday, $lte: endOfToday } },
        { scheduledDate: { $gte: startOfToday, $lte: endOfToday } },
      ],
    } as any);

    // 4. Active rentals count (items currently picked up or pending return)
    const activeRentalsCount = await this.bookingItemModel
      .aggregate([
        { $match: { providerId, itemType: 'PRODUCT' } },
        {
          $lookup: {
            from: 'bookings',
            localField: 'bookingId',
            foreignField: '_id',
            as: 'booking',
          },
        },
        { $unwind: '$booking' },
        {
          $match: {
            'booking.status': { $in: ['PICKED_UP', 'RETURN_PENDING'] },
          },
        },
        { $count: 'total' },
      ])
      .then((res) => res[0]?.total || 0);

    // 5. Returns due today and overdue returns
    const returnItems = await this.bookingItemModel.aggregate([
      {
        $match: {
          providerId,
          itemType: 'PRODUCT',
          rentalTo: { $ne: null },
        },
      },
      {
        $lookup: {
          from: 'bookings',
          localField: 'bookingId',
          foreignField: '_id',
          as: 'booking',
        },
      },
      { $unwind: '$booking' },
      {
        $match: {
          'booking.status': {
            $in: ['PICKED_UP', 'RETURN_PENDING', 'CONFIRMED'],
          },
        },
      },
      {
        $project: {
          rentalTo: 1,
        },
      },
    ]);

    let returnsDueTodayCount = 0;
    let overdueReturnsCount = 0;
    for (const item of returnItems) {
      const rTo = new Date(item.rentalTo);
      if (rTo >= startOfToday && rTo <= endOfToday) {
        returnsDueTodayCount += 1;
      } else if (rTo < startOfToday) {
        overdueReturnsCount += 1;
      }
    }

    return {
      revenueThisMonth,
      revenueLastMonth,
      revenueChangePct,
      selectedMonth,
      selectedMonthLabel,
      isCurrentMonth,
      pendingConfirmCount,
      oldestPendingAt,
      upcomingSchedulesCount,
      todaySchedulesCount,
      activeRentalsCount,
      returnsDueTodayCount,
      overdueReturnsCount,
    };
  }

  private async calculateChart(
    providerId: Types.ObjectId,
    period: OverviewPeriod,
    service: OverviewServiceFilter,
    now: Date,
    targetYear: number,
    targetMonth: number,
    selectedMonth: string,
    selectedMonthLabel: string,
    isCurrentMonth: boolean,
  ): Promise<{
    period: 'week' | 'month' | 'year';
    service: string;
    selectedMonth: string;
    selectedMonthLabel: string;
    points: ProviderOverviewChartPoint[];
    totals: { revenue: number; bookings: number };
  }> {
    // Generate buckets
    const points: ProviderOverviewChartPoint[] = [];
    let startDate: Date;
    let endDate: Date;

    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    if (period === OverviewPeriod.Week) {
      const padM = String(targetMonth).padStart(2, '0');
      const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
      const anchorDate = isCurrentMonth
        ? now
        : new Date(
            `${targetYear}-${padM}-${String(daysInTargetMonth).padStart(2, '0')}T12:00:00+07:00`,
          );

      for (let i = 6; i >= 0; i--) {
        const d = new Date(anchorDate.getTime() - i * 24 * 60 * 60 * 1000);
        const key = this.formatVnDateKey(d);
        const dayOfWeek = dayNames[this.getVnDayOfWeek(d)];
        const [, m, day] = key.split('-');
        points.push({
          key,
          label: `${dayOfWeek} (${day}/${m})`,
          revenue: 0,
          bookings: 0,
        });
      }
      startDate = new Date(`${points[0].key}T00:00:00+07:00`);
      endDate = new Date(`${points[points.length - 1].key}T23:59:59.999+07:00`);
    } else if (period === OverviewPeriod.Year) {
      // 12 months ending with targetMonth of targetYear
      const monthList: Array<{ y: number; m: number }> = [];
      for (let i = 11; i >= 0; i--) {
        let m = targetMonth - i;
        let y = targetYear;
        while (m <= 0) {
          m += 12;
          y -= 1;
        }
        monthList.push({ y, m });
      }

      for (const item of monthList) {
        const padM = String(item.m).padStart(2, '0');
        const key = `${item.y}-${padM}`;
        points.push({
          key,
          label: `Tháng ${item.m}`,
          revenue: 0,
          bookings: 0,
        });
      }
      startDate = new Date(`${points[0].key}-01T00:00:00+07:00`);
      const lastMonthKey = points[points.length - 1].key;
      const [lYear, lMonth] = lastMonthKey.split('-').map(Number);
      const daysInLastMonth = new Date(lYear, lMonth, 0).getDate();
      endDate = new Date(
        `${lYear}-${String(lMonth).padStart(2, '0')}-${String(daysInLastMonth).padStart(2, '0')}T23:59:59.999+07:00`,
      );
    } else {
      // Month: all days in targetMonth
      const padM = String(targetMonth).padStart(2, '0');
      const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const padDay = String(day).padStart(2, '0');
        const key = `${targetYear}-${padM}-${padDay}`;
        points.push({
          key,
          label: `${padDay}/${padM}`,
          revenue: 0,
          bookings: 0,
        });
      }
      startDate = new Date(`${targetYear}-${padM}-01T00:00:00+07:00`);
      endDate = new Date(
        `${targetYear}-${padM}-${String(daysInMonth).padStart(2, '0')}T23:59:59.999+07:00`,
      );
    }

    // Build aggregation filter
    const itemMatch: any = { providerId };
    if (service === OverviewServiceFilter.AoDaiRental) {
      itemMatch.itemType = 'PRODUCT';
    } else if (service === OverviewServiceFilter.Photography) {
      itemMatch.itemType = 'PHOTOGRAPHY_PACKAGE';
    }

    const bookingMatch: any = {
      'booking.status': { $in: VALID_REVENUE_STATUSES },
      'booking.createdAt': { $gte: startDate, $lte: endDate },
    };

    if (service === OverviewServiceFilter.Combo) {
      bookingMatch['booking.bookingType'] = 'COMBO';
    }

    const aggregated = await this.bookingItemModel.aggregate([
      { $match: itemMatch },
      {
        $lookup: {
          from: 'bookings',
          localField: 'bookingId',
          foreignField: '_id',
          as: 'booking',
        },
      },
      { $unwind: '$booking' },
      { $match: bookingMatch },
      {
        $project: {
          bookingId: '$booking._id',
          createdAt: '$booking.createdAt',
          netRevenue: {
            $max: [
              0,
              {
                $subtract: [
                  {
                    $multiply: [
                      '$unitPrice',
                      { $ifNull: ['$quantity', 1] },
                    ],
                  },
                  { $ifNull: ['$comboDiscountAmount', 0] },
                ],
              },
            ],
          },
        },
      },
    ]);

    const pointMap = new Map<
      string,
      { revenue: number; bookingIds: Set<string> }
    >();
    for (const p of points) {
      pointMap.set(p.key, { revenue: 0, bookingIds: new Set<string>() });
    }

    for (const item of aggregated) {
      const d = new Date(item.createdAt);
      const dateKey =
        period === OverviewPeriod.Year
          ? this.formatVnMonthKey(d)
          : this.formatVnDateKey(d);

      const target = pointMap.get(dateKey);
      if (target) {
        target.revenue += item.netRevenue || 0;
        target.bookingIds.add(item.bookingId.toString());
      }
    }

    let totalRevenue = 0;
    const allBookingIds = new Set<string>();

    for (const p of points) {
      const mapped = pointMap.get(p.key);
      if (mapped) {
        p.revenue = mapped.revenue;
        p.bookings = mapped.bookingIds.size;
        totalRevenue += p.revenue;
        for (const id of mapped.bookingIds) {
          allBookingIds.add(id);
        }
      }
    }

    return {
      period,
      service,
      selectedMonth,
      selectedMonthLabel,
      points,
      totals: {
        revenue: totalRevenue,
        bookings: allBookingIds.size,
      },
    };
  }

  private async calculateUpcomingSchedules(
    providerId: Types.ObjectId,
    startOfToday: Date,
  ): Promise<ProviderOverviewScheduleItem[]> {
    const rawSchedules = await this.bookingScheduleModel
      .find({
        providerId,
        status: { $in: ['CONFIRMED', 'SCHEDULED', 'HELD'] },
        $or: [
          { startsAt: { $gte: startOfToday } },
          { scheduledDate: { $gte: startOfToday } },
        ],
      } as any)
      .sort({ startsAt: 1, scheduledDate: 1 })
      .limit(4)
      .populate({
        path: 'bookingId',
        select: 'bookingCode status customerId',
        populate: {
          path: 'customerId',
          select: 'profile email',
        },
      })
      .populate({
        path: 'bookingItemId',
        select:
          'itemType productId photographyPackageId shootTimeSlot packageSnapshot',
      })
      .lean();

    const result: ProviderOverviewScheduleItem[] = [];

    for (const s of rawSchedules as any[]) {
      const b = s.bookingId;
      const item = s.bookingItemId;
      const cust = b?.customerId;
      const custName =
        cust?.profile?.fullName ||
        cust?.email?.split('@')[0] ||
        'Khách hàng';
      const avatarUrl = cust?.profile?.avatarUrl || null;

      const scheduleDate = s.startsAt
        ? new Date(s.startsAt)
        : s.scheduledDate
        ? new Date(s.scheduledDate)
        : startOfToday;
      const timeLabel =
        s.startsAt && s.endsAt
          ? `${this.formatVnTime(new Date(s.startsAt))} - ${this.formatVnTime(new Date(s.endsAt))}`
          : s.timeSlot || '09:00 - 12:00';

      let serviceName = 'Dịch vụ đặt lịch';
      if (item?.packageSnapshot?.name) {
        serviceName = item.packageSnapshot.name;
      } else if (item?.productId) {
        const prod = await this.productModel
          .findById(item.productId)
          .select('name')
          .lean();
        if (prod?.name) serviceName = prod.name;
      } else if (item?.photographyPackageId) {
        const pkg = await this.photographyPackageModel
          .findById(item.photographyPackageId)
          .select('name')
          .lean();
        if (pkg?.name) serviceName = pkg.name;
      }

      let type: 'PHOTOSHOOT' | 'PICKUP' | 'RETURN' = 'PHOTOSHOOT';
      let statusStr = 'Lịch chụp';
      let statusTone: 'amber' | 'blue' | 'green' | 'gray' = 'green';

      if (s.scheduleType === 'RETURN') {
        type = 'RETURN';
        statusStr = 'Sắp trả';
        statusTone = 'amber';
      } else if (s.scheduleType === 'PICKUP') {
        type = 'PICKUP';
        statusStr = 'Chờ lấy đồ';
        statusTone = 'blue';
      } else if (s.scheduleType === 'PHOTOSHOOT') {
        type = 'PHOTOSHOOT';
        statusStr = 'Lịch chụp';
        statusTone = 'green';
      }

      result.push({
        id: s._id.toString(),
        bookingId: b?._id ? b._id.toString() : '',
        bookingCode: b?.bookingCode || 'TAGO',
        type,
        startsAt: scheduleDate.toISOString(),
        endsAt: s.endsAt ? new Date(s.endsAt).toISOString() : null,
        timeLabel,
        customer: {
          name: custName,
          avatarUrl,
        },
        serviceName,
        status: statusStr,
        statusTone,
      });
    }

    return result;
  }

  private async calculateTasks(
    providerId: Types.ObjectId,
    userId: Types.ObjectId,
    startOfToday: Date,
    endOfToday: Date,
  ): Promise<ProviderOverviewTask[]> {
    const tasks: ProviderOverviewTask[] = [];

    // 1. Pending confirm bookings
    const pendingCount = await this.bookingModel.countDocuments({
      providerIds: providerId,
      status: { $in: ['DEPOSIT_PAID'] },
    } as any);
    if (pendingCount > 0) {
      tasks.push({
        id: 'task-confirm',
        type: 'CONFIRM_BOOKING',
        count: pendingCount,
        title: `${pendingCount} đơn đặt lịch chờ xác nhận`,
        description: 'Cần phản hồi khách hàng để đảm bảo lịch hẹn',
        urgency: 'urgent',
        targetView: 'orders',
      });
    }

    // 2. Overdue rentals
    const overdueReturnsCount = await this.bookingItemModel
      .aggregate([
        {
          $match: {
            providerId,
            itemType: 'PRODUCT',
            rentalTo: { $lt: startOfToday },
          },
        },
        {
          $lookup: {
            from: 'bookings',
            localField: 'bookingId',
            foreignField: '_id',
            as: 'booking',
          },
        },
        { $unwind: '$booking' },
        {
          $match: {
            'booking.status': { $in: ['PICKED_UP', 'RETURN_PENDING'] },
          },
        },
        { $count: 'total' },
      ])
      .then((res) => res[0]?.total || 0);

    if (overdueReturnsCount > 0) {
      tasks.push({
        id: 'task-overdue',
        type: 'RETURN_OVERDUE',
        count: overdueReturnsCount,
        title: `${overdueReturnsCount} đơn thuê áo dài quá hạn trả`,
        description: 'Liên hệ khách hàng để cập nhật tình trạng hoàn trả',
        urgency: 'urgent',
        targetView: 'rental-operations',
      });
    }

    // 3. Rentals due today
    const returnsDueTodayCount = await this.bookingItemModel
      .aggregate([
        {
          $match: {
            providerId,
            itemType: 'PRODUCT',
            rentalTo: { $gte: startOfToday, $lte: endOfToday },
          },
        },
        {
          $lookup: {
            from: 'bookings',
            localField: 'bookingId',
            foreignField: '_id',
            as: 'booking',
          },
        },
        { $unwind: '$booking' },
        {
          $match: {
            'booking.status': {
              $in: ['PICKED_UP', 'RETURN_PENDING', 'CONFIRMED'],
            },
          },
        },
        { $count: 'total' },
      ])
      .then((res) => res[0]?.total || 0);

    if (returnsDueTodayCount > 0) {
      tasks.push({
        id: 'task-due-today',
        type: 'RETURN_DUE',
        count: returnsDueTodayCount,
        title: `${returnsDueTodayCount} đơn thuê áo dài đến hạn trả hôm nay`,
        description: 'Kiểm tra trang phục và ghi nhận tình trạng trả',
        urgency: 'today',
        targetView: 'rental-operations',
      });
    }

    // 4. Schedules today
    const todaySchedulesCount = await this.bookingScheduleModel.countDocuments({
      providerId,
      status: { $in: ['CONFIRMED', 'SCHEDULED', 'HELD'] },
      $or: [
        { startsAt: { $gte: startOfToday, $lte: endOfToday } },
        { scheduledDate: { $gte: startOfToday, $lte: endOfToday } },
      ],
    } as any);
    if (todaySchedulesCount > 0) {
      tasks.push({
        id: 'task-today-sched',
        type: 'SHOOT_TODAY',
        count: todaySchedulesCount,
        title: `${todaySchedulesCount} lịch hẹn/lịch chụp diễn ra hôm nay`,
        description: 'Chuẩn bị trang phục hoặc thiết bị theo lịch hẹn',
        urgency: 'today',
        targetView: 'calendar',
      });
    }

    // 5. Unread notifications
    const unreadNotiCount = await this.notificationModel.countDocuments({
      userId,
      isRead: false,
    });
    if (unreadNotiCount > 0) {
      tasks.push({
        id: 'task-noti',
        type: 'UNREAD_NOTIFICATIONS',
        count: unreadNotiCount,
        title: `${unreadNotiCount} thông báo mới từ hệ thống`,
        description: 'Cập nhật tin nhắn và tương tác từ khách hàng',
        urgency: 'normal',
        targetView: 'notifications',
      });
    }

    return tasks;
  }

  private async calculateTopServices(
    providerId: Types.ObjectId,
  ): Promise<ProviderOverviewTopService[]> {
    const popularItems = await this.bookingItemModel.aggregate([
      { $match: { providerId } },
      {
        $lookup: {
          from: 'bookings',
          localField: 'bookingId',
          foreignField: '_id',
          as: 'booking',
        },
      },
      { $unwind: '$booking' },
      {
        $match: {
          'booking.status': { $in: VALID_REVENUE_STATUSES },
        },
      },
      {
        $group: {
          _id: {
            $ifNull: ['$productId', '$photographyPackageId'],
          },
          kind: {
            $first: {
              $cond: [
                { $ne: ['$productId', null] },
                'PRODUCT',
                'PHOTOGRAPHY_PACKAGE',
              ],
            },
          },
          count: { $sum: { $ifNull: ['$quantity', 1] } },
          revenue: {
            $sum: {
              $max: [
                0,
                {
                  $subtract: [
                    {
                      $multiply: [
                        '$unitPrice',
                        { $ifNull: ['$quantity', 1] },
                      ],
                    },
                    { $ifNull: ['$comboDiscountAmount', 0] },
                  ],
                },
              ],
            },
          },
        },
      },
      { $sort: { count: -1, revenue: -1 } },
      { $limit: 4 },
    ]);

    const result: ProviderOverviewTopService[] = [];
    const maxCount = popularItems[0]?.count || 1;

    for (const item of popularItems) {
      if (!item._id) continue;
      let name = 'Dịch vụ nổi bật';
      let image: string | null = null;

      if (item.kind === 'PRODUCT') {
        const prod = await this.productModel
          .findById(item._id)
          .select('name images')
          .lean();
        if (prod) {
          name = prod.name;
          image = prod.images?.[0] || null;
        }
      } else {
        const pkg = await this.photographyPackageModel
          .findById(item._id)
          .select('name images')
          .lean();
        if (pkg) {
          name = pkg.name;
          image = pkg.images?.[0] || null;
        }
      }

      const sharePct = Math.min(100, Math.round((item.count / maxCount) * 100));

      result.push({
        id: item._id.toString(),
        kind: item.kind,
        name,
        image,
        bookings: item.count,
        revenue: item.revenue,
        sharePct,
      });
    }

    return result;
  }

  private async calculateRecentActivities(
    providerId: Types.ObjectId,
  ): Promise<ProviderOverviewRecentActivity[]> {
    const recentBookings = await this.bookingModel
      .find({ providerIds: providerId })
      .select('bookingCode status updatedAt createdAt customerId')
      .sort({ updatedAt: -1 })
      .limit(6)
      .populate('customerId', 'profile email')
      .lean();

    const activities: ProviderOverviewRecentActivity[] = [];

    for (const b of recentBookings as any[]) {
      const cust = b.customerId;
      const custName =
        cust?.profile?.fullName || cust?.email?.split('@')[0] || 'Khách hàng';
      const code = b.bookingCode || 'Đơn hàng';
      const occurredAt = new Date(b.updatedAt || b.createdAt).toISOString();

      let title = `Cập nhật đơn ${code}`;
      let description = `Trạng thái: ${b.status}`;
      const type = b.status;

      switch (b.status) {
        case 'DEPOSIT_PAID':
          title = `${custName} đã đặt cọc đơn ${code}`;
          description = 'Đơn mới đang chờ đối tác xác nhận lịch hẹn';
          break;
        case 'CONFIRMED':
          title = `Xác nhận thành công đơn ${code}`;
          description = `Lịch hẹn với khách hàng ${custName} đã được cố định`;
          break;
        case 'PICKED_UP':
          title = `Khách hàng đã nhận đồ đơn ${code}`;
          description = `Bắt đầu tính thời gian thuê của khách hàng ${custName}`;
          break;
        case 'IN_PROGRESS':
          title = `Bắt đầu buổi chụp đơn ${code}`;
          description = `Buổi chụp ảnh cho khách ${custName} đang diễn ra`;
          break;
        case 'AWAITING_REVIEW':
          title = `Đã giao ảnh xem trước đơn ${code}`;
          description = 'Đang chờ khách duyệt và phản hồi ảnh chụp';
          break;
        case 'RETURNED':
          title = `Đã nhận trả trang phục đơn ${code}`;
          description = `Khách ${custName} đã hoàn trả trang phục thuê`;
          break;
        case 'COMPLETED':
          title = `Hoàn tất trọn vẹn đơn ${code}`;
          description = 'Đơn hàng đã hoàn thành và quyết toán ví thành công';
          break;
        case 'CANCELLED':
          title = `Đơn hàng ${code} đã bị huỷ`;
          description = 'Ghi nhận huỷ lịch theo chính sách của nền tảng';
          break;
      }

      activities.push({
        id: b._id.toString(),
        type,
        title,
        description,
        occurredAt,
        bookingId: b._id.toString(),
      });
    }

    return activities;
  }

  private async calculatePerformance(
    provider: any,
    providerId: Types.ObjectId,
  ): Promise<ProviderOverviewPerformance> {
    const avgRating = provider.rating?.averageRating ?? 5.0;
    const totalReviews = provider.rating?.totalReviews ?? 0;

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const oneEightyDaysAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

    const [
      allFinishedRecent,
      completedRecent,
      cancelledRecent,
      allFinishedPrev,
      cancelledPrev,
    ] = await Promise.all([
      this.bookingModel.countDocuments({
        providerIds: providerId,
        status: { $in: ['COMPLETED', 'CANCELLED', 'REFUNDED'] },
        createdAt: { $gte: ninetyDaysAgo },
      } as any),
      this.bookingModel.countDocuments({
        providerIds: providerId,
        status: 'COMPLETED',
        createdAt: { $gte: ninetyDaysAgo },
      } as any),
      this.bookingModel.countDocuments({
        providerIds: providerId,
        status: 'CANCELLED',
        createdAt: { $gte: ninetyDaysAgo },
      } as any),
      this.bookingModel.countDocuments({
        providerIds: providerId,
        status: { $in: ['COMPLETED', 'CANCELLED', 'REFUNDED'] },
        createdAt: { $gte: oneEightyDaysAgo, $lt: ninetyDaysAgo },
      } as any),
      this.bookingModel.countDocuments({
        providerIds: providerId,
        status: 'CANCELLED',
        createdAt: { $gte: oneEightyDaysAgo, $lt: ninetyDaysAgo },
      } as any),
    ]);

    const completionRate =
      allFinishedRecent > 0
        ? Math.round((completedRecent / allFinishedRecent) * 100)
        : null;

    const cancelRate =
      allFinishedRecent > 0
        ? Math.round((cancelledRecent / allFinishedRecent) * 100)
        : null;

    const cancelRatePrev =
      allFinishedPrev > 0
        ? Math.round((cancelledPrev / allFinishedPrev) * 100)
        : null;

    const isVerified = provider.status === 'ACTIVE';

    return {
      averageRating: avgRating,
      totalReviews,
      completionRate,
      cancelRate,
      cancelRatePrev,
      isVerified,
    };
  }

  // --- Date Helpers (Asia/Ho_Chi_Minh: UTC+7) ---

  private getVnDateParts(d: Date): { year: number; month: number; day: number } {
    const str = d.toLocaleDateString('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
    }); // "YYYY-MM-DD"
    const [year, month, day] = str.split('-').map(Number);
    return { year, month, day };
  }

  private formatVnDateKey(d: Date): string {
    return d.toLocaleDateString('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
    }); // "YYYY-MM-DD"
  }

  private formatVnMonthKey(d: Date): string {
    const { year, month } = this.getVnDateParts(d);
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  private getVnDayOfWeek(d: Date): number {
    // 0 = Sunday, 1 = Monday, ...
    const dateStr = d.toLocaleDateString('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      weekday: 'short',
    });
    const map: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    return map[dateStr] ?? d.getDay();
  }

  private formatVnTime(d: Date): string {
    return d.toLocaleTimeString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
}
