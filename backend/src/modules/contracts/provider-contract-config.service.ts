import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { ContractAccessService } from './contract-access.service';
import { contractObjectId } from './contract-source.types';
import { CONTRACTS_V2_ENABLED } from './contracts.constants';
import {
  ProviderContractConfigResponseDto,
  UpdateProviderContractConfigDto,
} from './dto/provider-contract-config.dto';
import {
  ProviderRentalContractConfig,
  ProviderContractMode,
} from './schemas/provider-contract-config.schema';
import { ProviderRentalContractConfigAudit } from './schemas/provider-contract-config-audit.schema';

@Injectable()
export class ProviderContractConfigService {
  constructor(
    @Inject(CONTRACTS_V2_ENABLED) private readonly enabled: boolean,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(ProviderRentalContractConfig.name)
    private readonly configModel: Model<ProviderRentalContractConfig>,
    @InjectModel(ProviderRentalContractConfigAudit.name)
    private readonly auditModel: Model<ProviderRentalContractConfigAudit>,
    private readonly access: ContractAccessService,
  ) {}

  async getConfig(user: AuthUser): Promise<ProviderContractConfigResponseDto> {
    if (!this.enabled) {
      throw new ServiceUnavailableException('CONTRACTS_V2_DISABLED');
    }
    if (!user.roles.includes('PROVIDER')) {
      throw new ForbiddenException('PROVIDER_ROLE_REQUIRED: Chỉ đối tác cho thuê mới được xem cấu hình này.');
    }
    const provider = await this.access.ownProvider(user);
    const existing = await this.configModel
      .findOne({ providerId: provider._id })
      .lean();

    if (!existing) {
      return {
        providerId: provider._id.toString(),
        contractMode: ProviderContractMode.AUTO,
        orderThresholdAmount: null,
        version: 1,
        effectiveFrom: new Date(),
        updatedByUserId: user.sub,
        isDefault: true,
      };
    }

    return {
      providerId: existing.providerId.toString(),
      contractMode: existing.contractMode,
      orderThresholdAmount: existing.orderThresholdAmount ?? null,
      version: existing.version,
      effectiveFrom: existing.effectiveFrom,
      updatedByUserId: existing.updatedByUserId.toString(),
      isDefault: false,
    };
  }

  async updateConfig(
    user: AuthUser,
    dto: UpdateProviderContractConfigDto,
    meta?: { ipAddress?: string | null; userAgent?: string | null },
  ): Promise<ProviderContractConfigResponseDto> {
    if (!this.enabled) {
      throw new ServiceUnavailableException('CONTRACTS_V2_DISABLED');
    }
    if (!user.roles.includes('PROVIDER')) {
      throw new ForbiddenException('PROVIDER_ROLE_REQUIRED: Chỉ đối tác cho thuê mới được cập nhật cấu hình này.');
    }
    const provider = await this.access.ownProvider(user);
    const status = String(provider.status || '').toUpperCase();
    if (status !== 'ACTIVE') {
      throw new ForbiddenException('PROVIDER_NOT_ACTIVE: Tài khoản đối tác chưa được kích hoạt.');
    }
    const actorId = contractObjectId(user.sub);

    // Validation rules
    let sanitizedThreshold: number | null = null;
    if (dto.contractMode === ProviderContractMode.CUSTOM_ORDER_THRESHOLD) {
      if (
        typeof dto.orderThresholdAmount !== 'number' ||
        !Number.isFinite(dto.orderThresholdAmount) ||
        dto.orderThresholdAmount < 0
      ) {
        throw new BadRequestException(
          'Vui lòng nhập số tiền ngưỡng giá trị đơn hàng hợp lệ (từ 0 VNĐ trở lên).',
        );
      }
      if (dto.orderThresholdAmount > 100_000_000) {
        throw new BadRequestException(
          'Ngưỡng giá trị đơn hàng tối đa không được vượt quá 100.000.000 VNĐ.',
        );
      }
      sanitizedThreshold = Math.round(dto.orderThresholdAmount);
    }

    const session = await this.connection.startSession();
    try {
      let updated: ProviderRentalContractConfig | null = null;

      await session.withTransaction(async () => {
        const existing = await this.configModel
          .findOne({ providerId: provider._id })
          .session(session);

        const newVersion = existing ? existing.version + 1 : 1;
        const effectiveFrom = new Date();

        if (existing) {
          existing.contractMode = dto.contractMode;
          existing.orderThresholdAmount = sanitizedThreshold;
          existing.version = newVersion;
          existing.effectiveFrom = effectiveFrom;
          existing.updatedByUserId = actorId;
          updated = await existing.save({ session });
        } else {
          const created = await this.configModel.create(
            [
              {
                providerId: provider._id,
                contractMode: dto.contractMode,
                orderThresholdAmount: sanitizedThreshold,
                version: newVersion,
                effectiveFrom,
                updatedByUserId: actorId,
              },
            ],
            { session },
          );
          updated = created[0];
        }

        // Bounded separate audit log collection
        await this.auditModel.create(
          [
            {
              providerId: provider._id,
              version: newVersion,
              contractMode: dto.contractMode,
              orderThresholdAmount: sanitizedThreshold,
              effectiveFrom,
              updatedByUserId: actorId,
              ipAddress: meta?.ipAddress?.trim() || null,
              userAgent: meta?.userAgent?.trim() || null,
              changeNote: dto.changeNote?.trim() || null,
            },
          ],
          { session },
        );
      });

      if (!updated) {
        throw new BadRequestException('Không thể lưu cấu hình hợp đồng');
      }

      const res = updated as ProviderRentalContractConfig;
      return {
        providerId: res.providerId.toString(),
        contractMode: res.contractMode,
        orderThresholdAmount: res.orderThresholdAmount ?? null,
        version: res.version,
        effectiveFrom: res.effectiveFrom,
        updatedByUserId: res.updatedByUserId.toString(),
        isDefault: false,
      };
    } finally {
      await session.endSession();
    }
  }

  async getConfigForProvider(
    providerId: Types.ObjectId,
  ): Promise<ProviderRentalContractConfig | null> {
    if (!this.enabled) return null;
    return this.configModel.findOne({ providerId }).lean();
  }

  async getAuditHistory(
    user: AuthUser,
    limit = 20,
  ): Promise<ProviderRentalContractConfigAudit[]> {
    if (!this.enabled) {
      throw new ServiceUnavailableException('CONTRACTS_V2_DISABLED');
    }
    if (!user.roles.includes('PROVIDER')) {
      throw new ForbiddenException('PROVIDER_ROLE_REQUIRED: Chỉ đối tác cho thuê mới được xem lịch sử cấu hình.');
    }
    const provider = await this.access.ownProvider(user);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    return this.auditModel
      .find({ providerId: provider._id })
      .sort({ version: -1 })
      .limit(safeLimit)
      .lean();
  }
}
