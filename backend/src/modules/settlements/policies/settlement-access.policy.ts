import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Provider } from '../../providers/schemas/provider.schema';
import { SETTLEMENT_ERROR_CODES } from '../constants/settlement-error-codes';

@Injectable()
export class SettlementAccessPolicy {
  constructor(
    @InjectModel(Provider.name)
    private readonly providerModel: Model<Provider>,
  ) {}

  async resolveProviderForCurrentUser(userId: string): Promise<Provider & { _id: Types.ObjectId }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new ForbiddenException(SETTLEMENT_ERROR_CODES.PermissionDenied);
    }

    const provider = await this.providerModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .lean<Provider & { _id: Types.ObjectId }>();

    if (!provider) {
      throw new NotFoundException(SETTLEMENT_ERROR_CODES.ProviderNotFound);
    }

    return provider;
  }

  assertProviderCanView(
    settlementProviderId: Types.ObjectId,
    providerId: Types.ObjectId,
  ): void {
    if (settlementProviderId.toString() !== providerId.toString()) {
      throw new ForbiddenException(SETTLEMENT_ERROR_CODES.PermissionDenied);
    }
  }
}
