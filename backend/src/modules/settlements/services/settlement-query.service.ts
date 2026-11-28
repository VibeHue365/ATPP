import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingStatus } from '../../bookings/schemas/booking.schema';
import { SETTLEMENT_ERROR_CODES } from '../constants/settlement-error-codes';
import { SettlementStatus } from '../constants/settlement-status.enum';
import {
  QueryProviderSettlementsDto,
  QuerySettlementsDto,
} from '../dto/settlement.dto';
import { Settlement } from '../schemas/settlement.schema';
import { SettlementsService } from './settlements.service';

export interface SettlementSummaryBucket {
  amount: number;
  count: number;
}

export interface AdminSettlementsSummary {
  pending: SettlementSummaryBucket;
  settled: SettlementSummaryBucket;
  held: SettlementSummaryBucket;
  cancelled: SettlementSummaryBucket;
  totalCount: number;
}

export interface ProviderSettlementsSummary {
  totalGrossRevenue: number;
  totalPlatformFee: number;
  totalCompensation: number;
  totalNetEarnings: number;
  pending: SettlementSummaryBucket;
  settled: SettlementSummaryBucket;
  held: SettlementSummaryBucket;
  cancelled: SettlementSummaryBucket;
  activeCount: number;
  totalCount: number;
}

@Injectable()
export class SettlementQueryService {
  constructor(
    @InjectModel(Settlement.name)
    private readonly settlementModel: Model<Settlement>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<Booking>,
    private readonly settlementsService: SettlementsService,
  ) {}

  async findAdminSettlements(query: QuerySettlementsDto) {
    this.assertValidDateRange(query.fromDate, query.toDate);
    const filter = this.buildFilter(query);
    const summaryFilter = this.buildFilter({
      ...query,
      status: undefined,
    });
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total, summaryRows] = await Promise.all([
      this.settlementModel
        .find(filter)
        .populate('bookingId', 'bookingCode status completedAt createdAt')
        .populate('providerId', 'businessName paymentAccounts')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.settlementModel.countDocuments(filter),
      this.settlementModel.aggregate<{
        _id: SettlementStatus;
        amount: number;
        count: number;
      }>([
        { $match: summaryFilter },
        {
          $group: {
            _id: '$status',
            amount: {
              $sum: {
                $cond: [
                  { $eq: ['$status', SettlementStatus.Cancelled] },
                  {
                    $ifNull: [
                      '$netAmount',
                      { $ifNull: ['$payableAmount', 0] },
                    ],
                  },
                  { $ifNull: ['$payableAmount', 0] },
                ],
              },
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const byStatus = new Map(
      summaryRows.map((row) => [
        row._id,
        {
          amount: Number(row.amount || 0),
          count: Number(row.count || 0),
        },
      ]),
    );

    const pending = byStatus.get(SettlementStatus.ReadyToSettle) ?? {
      amount: 0,
      count: 0,
    };
    const settled = byStatus.get(SettlementStatus.Settled) ?? {
      amount: 0,
      count: 0,
    };
    const held = byStatus.get(SettlementStatus.OnHold) ?? {
      amount: 0,
      count: 0,
    };
    const cancelled = byStatus.get(SettlementStatus.Cancelled) ?? {
      amount: 0,
      count: 0,
    };

    const summary: AdminSettlementsSummary = {
      pending,
      settled,
      held,
      cancelled,
      totalCount: pending.count + settled.count + held.count + cancelled.count,
    };

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary,
    };
  }

  async findProviderSettlements(
    providerId: Types.ObjectId,
    query: QueryProviderSettlementsDto,
  ) {
    this.assertValidDateRange(query.fromDate, query.toDate);

    // Self-healing: auto-create settlement for any COMPLETED bookings of this provider that don't have one yet
    try {
      const itemsForProvider = await this.bookingModel.db
        .model('BookingItem')
        .find({ providerId })
        .distinct('bookingId');
      const completedBookings = await this.bookingModel
        .find({
          $or: [
            { providerIds: providerId },
            { providerId: providerId as any },
            { _id: { $in: itemsForProvider } },
          ],
          status: BookingStatus.Completed,
        })
        .lean();

      for (const b of completedBookings) {
        const exists = await this.settlementModel.exists({
          bookingId: b._id,
          providerId,
        });
        if (!exists) {
          await this.settlementsService.createSettlementsForBooking(
            b._id.toString(),
          );
        }
      }
    } catch (_e) {
      // Ignore background sync errors
    }

    const filter = this.buildFilter({
      ...query,
      providerId: providerId.toString(),
    });
    const hasDateFilter = Boolean(query.fromDate || query.toDate);
    const filteredSummaryFilter = this.buildFilter({
      ...query,
      providerId: providerId.toString(),
      status: undefined,
    });
    const lifetimeFilter: Record<string, unknown> = { providerId };
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total, lifetimeSummary, filteredSummary] = await Promise.all([
      this.settlementModel
        .find(filter)
        .populate('bookingId', 'bookingCode status completedAt createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.settlementModel.countDocuments(filter),
      this.aggregateProviderSummary(lifetimeFilter),
      hasDateFilter
        ? this.aggregateProviderSummary(filteredSummaryFilter)
        : Promise.resolve(null),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: filteredSummary ?? lifetimeSummary,
      lifetimeSummary,
    };
  }

  private async aggregateProviderSummary(
    matchFilter: Record<string, unknown>,
  ): Promise<ProviderSettlementsSummary> {
    const rows = await this.settlementModel.aggregate<{
      _id: SettlementStatus;
      amount: number;
      gross: number;
      fee: number;
      compensation: number;
      count: number;
    }>([
      { $match: matchFilter },
      {
        $group: {
          _id: '$status',
          amount: {
            $sum: {
              $cond: [
                { $eq: ['$status', SettlementStatus.Cancelled] },
                {
                  $ifNull: ['$netAmount', { $ifNull: ['$payableAmount', 0] }],
                },
                { $ifNull: ['$payableAmount', 0] },
              ],
            },
          },
          gross: { $sum: { $ifNull: ['$grossAmount', 0] } },
          fee: {
            $sum: {
              $add: [
                { $ifNull: ['$commissionAmount', 0] },
                {
                  $ifNull: [
                    '$allocatedPlatformFee',
                    { $ifNull: ['$fixedPlatformFee', 0] },
                  ],
                },
              ],
            },
          },
          compensation: { $sum: { $ifNull: ['$compensationAmount', 0] } },
          count: { $sum: 1 },
        },
      },
    ]);

    const byStatus = new Map(
      rows.map((row) => [
        row._id,
        {
          amount: Number(row.amount || 0),
          gross: Number(row.gross || 0),
          fee: Number(row.fee || 0),
          compensation: Number(row.compensation || 0),
          count: Number(row.count || 0),
        },
      ]),
    );

    const empty = { amount: 0, gross: 0, fee: 0, compensation: 0, count: 0 };
    const pendingRow = byStatus.get(SettlementStatus.ReadyToSettle) ?? empty;
    const settledRow = byStatus.get(SettlementStatus.Settled) ?? empty;
    const heldRow = byStatus.get(SettlementStatus.OnHold) ?? empty;
    const cancelledRow = byStatus.get(SettlementStatus.Cancelled) ?? empty;

    const activeRows = [pendingRow, settledRow, heldRow];

    return {
      totalGrossRevenue: activeRows.reduce((s, r) => s + r.gross, 0),
      totalPlatformFee: activeRows.reduce((s, r) => s + r.fee, 0),
      totalCompensation: activeRows.reduce((s, r) => s + r.compensation, 0),
      totalNetEarnings: activeRows.reduce((s, r) => s + r.amount, 0),
      pending: { amount: pendingRow.amount, count: pendingRow.count },
      settled: { amount: settledRow.amount, count: settledRow.count },
      held: { amount: heldRow.amount, count: heldRow.count },
      cancelled: { amount: cancelledRow.amount, count: cancelledRow.count },
      activeCount: pendingRow.count + settledRow.count + heldRow.count,
      totalCount:
        pendingRow.count +
        settledRow.count +
        heldRow.count +
        cancelledRow.count,
    };
  }

  async findById(id: string) {
    const objectId = this.toObjectId(id);
    const settlement = await this.settlementModel
      .findById(objectId)
      .populate('bookingId', 'bookingCode status completedAt createdAt')
      .populate('providerId', 'businessName paymentAccounts')
      .lean();

    if (!settlement) {
      throw new NotFoundException(SETTLEMENT_ERROR_CODES.NotFound);
    }

    return settlement;
  }

  async findProviderSettlementById(id: string, providerId: Types.ObjectId) {
    const objectId = this.toObjectId(id);
    const settlement = await this.settlementModel
      .findOne({ _id: objectId, providerId })
      .populate('bookingId', 'bookingCode status completedAt createdAt')
      .lean();

    if (!settlement) {
      throw new NotFoundException(SETTLEMENT_ERROR_CODES.NotFound);
    }

    return settlement;
  }

  async findByBookingId(bookingId: string) {
    const objectId = this.toObjectId(bookingId);
    return this.settlementModel
      .find({ bookingId: objectId })
      .populate('bookingId', 'bookingCode status completedAt createdAt')
      .populate('providerId', 'businessName paymentAccounts')
      .sort({ providerId: 1 })
      .lean();
  }

  async findByBookingAndProvider(
    bookingId: Types.ObjectId,
    providerId: Types.ObjectId,
  ) {
    return this.settlementModel.findOne({ bookingId, providerId }).lean();
  }

  private buildFilter(query: QuerySettlementsDto): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    if (query.bookingId) {
      filter.bookingId = this.toObjectId(query.bookingId);
    }

    if (query.providerId) {
      filter.providerId = this.toObjectId(query.providerId);
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.fromDate || query.toDate) {
      const createdAt: Record<string, Date> = {};
      if (query.fromDate) {
        createdAt.$gte = query.fromDate;
      }
      if (query.toDate) {
        createdAt.$lte = query.toDate;
      }
      filter.createdAt = createdAt;
    }

    return filter;
  }

  private assertValidDateRange(fromDate?: Date, toDate?: Date): void {
    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException(SETTLEMENT_ERROR_CODES.DateRangeInvalid);
    }
  }

  private toObjectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ObjectId');
    }

    return new Types.ObjectId(id);
  }
}
