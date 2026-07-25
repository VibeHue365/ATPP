import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import type { QueryFilter, UpdateQuery } from 'mongoose';
import { Booking, BookingDocument } from '../schemas/booking.schema';
import {
  BookingItem,
  BookingItemDocument,
} from '../schemas/booking-item.schema';
import {
  BookingSchedule,
  BookingScheduleDocument,
} from '../schemas/booking-schedule.schema';

@Injectable()
export class BookingsRepository {
  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<Booking>,
    @InjectModel(BookingItem.name)
    private readonly bookingItemModel: Model<BookingItem>,
    @InjectModel(BookingSchedule.name)
    private readonly bookingScheduleModel: Model<BookingSchedule>,
  ) {}

  async startSession(): Promise<ClientSession> {
    return this.bookingModel.db.startSession();
  }

  // --- Booking Operations ---

  async findBookingById(
    id: Types.ObjectId | string,
    session?: ClientSession,
  ): Promise<BookingDocument | null> {
    const q = this.bookingModel.findById(id);
    if (session) q.session(session);
    return q.exec();
  }

  async findBookings(
    filter: QueryFilter<Booking>,
    sort: any = { createdAt: -1 },
    session?: ClientSession,
  ): Promise<BookingDocument[]> {
    const q = this.bookingModel.find(filter).sort(sort);
    if (session) q.session(session);
    return q.exec();
  }

  async findOneBooking(
    filter: QueryFilter<Booking>,
    session?: ClientSession,
  ): Promise<BookingDocument | null> {
    const q = this.bookingModel.findOne(filter);
    if (session) q.session(session);
    return q.exec();
  }

  async createBooking(
    data: Partial<Booking>,
    session?: ClientSession,
  ): Promise<BookingDocument> {
    const booking = new this.bookingModel(data);
    return booking.save({ session });
  }

  async updateBooking(
    id: Types.ObjectId | string,
    update: UpdateQuery<Booking>,
    session?: ClientSession,
  ): Promise<BookingDocument | null> {
    const q = this.bookingModel.findByIdAndUpdate(id, update, { new: true });
    if (session) q.session(session);
    return q.exec();
  }

  async updateManyBookings(
    filter: QueryFilter<Booking>,
    update: UpdateQuery<Booking>,
    session?: ClientSession,
  ): Promise<any> {
    const q = this.bookingModel.updateMany(filter, update);
    if (session) q.session(session);
    return q.exec();
  }

  // --- BookingItem Operations ---

  async findBookingItems(
    filter: QueryFilter<BookingItem>,
    populateConfigs?: any[],
    session?: ClientSession,
  ): Promise<BookingItemDocument[]> {
    let q = this.bookingItemModel.find(filter);
    if (populateConfigs) {
      for (const populateConfig of populateConfigs) {
        q = q.populate(populateConfig);
      }
    }
    if (session) q.session(session);
    return q.exec();
  }

  async findOneBookingItem(
    filter: QueryFilter<BookingItem>,
    session?: ClientSession,
  ): Promise<BookingItemDocument | null> {
    const q = this.bookingItemModel.findOne(filter);
    if (session) q.session(session);
    return q.exec();
  }

  async createBookingItem(
    data: Partial<BookingItem>,
    session?: ClientSession,
  ): Promise<BookingItemDocument> {
    const item = new this.bookingItemModel(data);
    return item.save({ session });
  }

  async updateBookingItem(
    id: Types.ObjectId | string,
    update: UpdateQuery<BookingItem>,
    session?: ClientSession,
  ): Promise<BookingItemDocument | null> {
    const q = this.bookingItemModel.findByIdAndUpdate(id, update, {
      new: true,
    });
    if (session) q.session(session);
    return q.exec();
  }

  async updateManyBookingItems(
    filter: QueryFilter<BookingItem>,
    update: UpdateQuery<BookingItem>,
    session?: ClientSession,
  ): Promise<any> {
    const q = this.bookingItemModel.updateMany(filter, update);
    if (session) q.session(session);
    return q.exec();
  }

  async deleteManyBookingItems(
    filter: QueryFilter<BookingItem>,
    session?: ClientSession,
  ): Promise<any> {
    const q = this.bookingItemModel.deleteMany(filter);
    if (session) q.session(session);
    return q.exec();
  }

  // --- BookingSchedule Operations ---

  async findSchedules(
    filter: QueryFilter<BookingSchedule>,
    session?: ClientSession,
  ): Promise<BookingScheduleDocument[]> {
    const q = this.bookingScheduleModel.find(filter);
    if (session) q.session(session);
    return q.exec();
  }

  async createSchedule(
    data: Partial<BookingSchedule>,
    session?: ClientSession,
  ): Promise<BookingScheduleDocument> {
    const schedule = new this.bookingScheduleModel(data);
    return schedule.save({ session });
  }

  async updateManySchedules(
    filter: QueryFilter<BookingSchedule>,
    update: UpdateQuery<BookingSchedule>,
    session?: ClientSession,
  ): Promise<any> {
    const q = this.bookingScheduleModel.updateMany(filter, update);
    if (session) q.session(session);
    return q.exec();
  }

  async deleteManySchedules(
    filter: QueryFilter<BookingSchedule>,
    session?: ClientSession,
  ): Promise<any> {
    const q = this.bookingScheduleModel.deleteMany(filter);
    if (session) q.session(session);
    return q.exec();
  }
}
