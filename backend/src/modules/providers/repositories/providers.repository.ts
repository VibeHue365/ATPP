import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Provider, ProviderDocument } from '../schemas/provider.schema';
import {
  ProviderSchedule,
  ProviderScheduleDocument,
  ScheduleCapability,
  ScheduleType,
} from '../../products/schemas/provider-schedule.schema';

@Injectable()
export class ProvidersRepository {
  constructor(
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
    @InjectModel(ProviderSchedule.name)
    private readonly scheduleModel: Model<ProviderSchedule>,
  ) {}

  async findByUserId(userId: Types.ObjectId): Promise<ProviderDocument | null> {
    return this.providerModel.findOne({ userId });
  }

  async findById(providerId: Types.ObjectId): Promise<ProviderDocument | null> {
    return this.providerModel.findById(providerId);
  }

  async create(data: Partial<Provider>): Promise<ProviderDocument> {
    return this.providerModel.create(data);
  }

  async update(
    providerId: Types.ObjectId,
    update: Partial<Provider>,
  ): Promise<ProviderDocument | null> {
    return this.providerModel.findByIdAndUpdate(
      providerId,
      { $set: update },
      { new: true },
    );
  }

  async addPortfolioImage(
    providerId: Types.ObjectId,
    imageUrl: string,
  ): Promise<ProviderDocument | null> {
    return this.providerModel.findByIdAndUpdate(
      providerId,
      { $addToSet: { 'media.images': imageUrl } },
      { new: true },
    );
  }

  async removePortfolioImage(
    providerId: Types.ObjectId,
    imageUrl: string,
  ): Promise<ProviderDocument | null> {
    return this.providerModel.findByIdAndUpdate(
      providerId,
      { $pull: { 'media.images': imageUrl } },
      { new: true },
    );
  }

  // SCHEDULE METHODS
  async findSchedulesByProviderId(
    providerId: Types.ObjectId,
  ): Promise<ProviderScheduleDocument[]> {
    return this.scheduleModel.find({ providerId });
  }

  async upsertRecurringSchedule(
    providerId: Types.ObjectId,
    dayOfWeek: number,
    workingHours: Array<{ start: string; end: string }>,
    capability: ScheduleCapability | null = null,
  ): Promise<ProviderScheduleDocument> {
    const result = await this.scheduleModel
      .findOneAndUpdate(
        { providerId, dayOfWeek, scheduleType: ScheduleType.Recurring, capability: capability ?? null },
        { $set: { workingHours, offDays: [], capability: capability ?? null } },
        { upsert: true, new: true },
      )
      .exec();
    return result;
  }

  async upsertSpecificDateSchedule(
    providerId: Types.ObjectId,
    specificDate: Date,
    offDays: Date[],
    customSlots: Array<{ timeSlot: string; status: string }>,
    capability: ScheduleCapability | null = null,
  ): Promise<ProviderScheduleDocument> {
    // Normalize date to midnight
    const normalizedDate = new Date(specificDate);
    normalizedDate.setHours(0, 0, 0, 0);

    const result = await this.scheduleModel
      .findOneAndUpdate(
        {
          providerId,
          specificDate: normalizedDate,
          scheduleType: ScheduleType.SpecificDate,
          capability: capability ?? null,
        },
        { $set: { offDays, customSlots, workingHours: [], capability: capability ?? null } },
        { upsert: true, new: true },
      )
      .exec();
    return result;
  }
}
