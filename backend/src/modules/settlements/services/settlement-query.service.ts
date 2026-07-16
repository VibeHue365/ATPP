import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SETTLEMENT_ERROR_CODES } from '../constants/settlement-error-codes';
import {
  QueryProviderSettlementsDto,
  QuerySettlementsDto,
} from '../dto/settlement.dto';
import { Settlement } from '../schemas/settlement.schema';

@Injectable()
export class SettlementQueryService {
  constructor(
    @InjectModel(Settlement.name)
    private readonly settlementModel: Model<Settlement>,
  ) {}

  async findAdminSettlements(query: QuerySettlementsDto) {
    this.assertValidDateRange(query.fromDate, query.toDate);
    const filter = this.buildFilter(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.settlementModel
        .find(filter)
        .populate('bookingId', 'bookingCode status completedAt createdAt')
        .populate('providerId', 'businessName paymentAccounts')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.settlementModel.countDocuments(filter),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findProviderSettlements(
    providerId: Types.ObjectId,
    query: QueryProviderSettlementsDto,
  ) {
    this.assertValidDateRange(query.fromDate, query.toDate);
    const filter = this.buildFilter({
      ...query,
      providerId: providerId.toString(),
    });
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.settlementModel
        .find(filter)
        .populate('bookingId', 'bookingCode status completedAt createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.settlementModel.countDocuments(filter),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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
