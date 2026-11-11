import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  BookingSource,
  contractDb,
  contractObjectId,
} from './contract-source.types';

export interface ContractReadScope {
  kind: 'CUSTOMER' | 'PROVIDER' | 'ADMIN';
  providerId?: Types.ObjectId;
}

@Injectable()
export class ContractAccessService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async booking(bookingId: string): Promise<BookingSource> {
    const booking = (await contractDb(this.connection)
      .collection('bookings')
      .findOne({
        _id: contractObjectId(bookingId),
      })) as BookingSource | null;
    if (!booking) throw new NotFoundException('CONTRACT_BOOKING_NOT_FOUND');
    return booking;
  }

  async markContractFlowVersion(
    bookingId: Types.ObjectId,
    version = 2,
  ): Promise<void> {
    await contractDb(this.connection)
      .collection('bookings')
      .updateOne({ _id: bookingId }, { $set: { contractFlowVersion: version } });
  }

  async assertBookingReader(
    user: AuthUser,
    booking: BookingSource,
  ): Promise<ContractReadScope> {
    const actorId = contractObjectId(user.sub);
    if (booking.customerId.toString() === actorId.toString())
      return { kind: 'CUSTOMER' };
    if (
      user.roles &&
      (user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN')) &&
      user.permissions &&
      user.permissions.includes('user:read') &&
      user.permissions.includes('provider:read')
    )
      return { kind: 'ADMIN' };
    const rawIds = (booking.providerIds ?? []) as Array<string | Types.ObjectId>;
    const searchIds: Types.ObjectId[] = rawIds
      .map((id) => (id instanceof Types.ObjectId ? id : Types.ObjectId.isValid(id?.toString()) ? new Types.ObjectId(id) : null))
      .filter((id): id is Types.ObjectId => id !== null);

    if (searchIds.length === 0) {
      throw new NotFoundException('CONTRACT_NOT_FOUND');
    }

    const provider = await contractDb(this.connection)
      .collection('providers')
      .findOne(
        {
          userId: actorId,
          _id: { $in: searchIds },
        },
        { projection: { _id: 1 } },
      );
    if (provider) return { kind: 'PROVIDER', providerId: provider._id as Types.ObjectId };
    throw new NotFoundException('CONTRACT_NOT_FOUND');
  }

  async assertContractReader(
    user: AuthUser,
    booking: BookingSource,
    contractProviderId: Types.ObjectId,
  ): Promise<ContractReadScope> {
    const scope = await this.assertBookingReader(user, booking);
    if (
      scope.kind === 'PROVIDER' &&
      scope.providerId?.toString() !== contractProviderId.toString()
    )
      throw new NotFoundException('CONTRACT_NOT_FOUND');
    return scope;
  }

  assertCustomer(user: AuthUser, booking: BookingSource): void {
    if (booking.customerId.toString() !== contractObjectId(user.sub).toString())
      throw new NotFoundException('CONTRACT_NOT_FOUND');
  }

  async ownProvider(user: AuthUser) {
    const provider = await contractDb(this.connection)
      .collection('providers')
      .findOne(
        {
          userId: contractObjectId(user.sub),
        },
        { projection: { _id: 1, userId: 1, status: 1, capabilities: 1 } },
      );
    if (!provider) throw new NotFoundException('PROVIDER_NOT_FOUND');
    return provider;
  }
}
