import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Provider, ProviderDocument } from '../schemas/provider.schema';
import {
  ProviderSchedule,
  ProviderScheduleDocument,
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
  ): Promise<ProviderScheduleDocument> {
    const result = await this.scheduleModel
      .findOneAndUpdate(
        { providerId, dayOfWeek, scheduleType: ScheduleType.Recurring },
        { $set: { workingHours, offDays: [] } },
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
        },
        { $set: { offDays, customSlots, workingHours: [] } },
        { upsert: true, new: true },
      )
      .exec();
    return result;
  }
}
