import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ProviderContractMode } from '../schemas/provider-contract-config.schema';

export class UpdateProviderContractConfigDto {
  @IsEnum(ProviderContractMode, {
    message: 'Chế độ hợp đồng phải là AUTO, CUSTOM_ORDER_THRESHOLD hoặc ALWAYS_DETAILED',
  })
  contractMode: ProviderContractMode;

  @ValidateIf((o: UpdateProviderContractConfigDto) => o.contractMode === ProviderContractMode.CUSTOM_ORDER_THRESHOLD)
  @IsInt({ message: 'Ngưỡng giá trị đơn hàng phải là số nguyên' })
  @Min(0, { message: 'Ngưỡng giá trị đơn hàng không được nhỏ hơn 0 VNĐ' })
  @Max(100_000_000, { message: 'Ngưỡng giá trị đơn hàng tối đa không vượt quá 100.000.000 VNĐ' })
  orderThresholdAmount?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeNote?: string | null;
}

export interface ProviderContractConfigResponseDto {
  providerId: string;
  contractMode: ProviderContractMode;
  orderThresholdAmount: number | null;
  version: number;
  effectiveFrom: Date;
  updatedByUserId: string;
  isDefault: boolean;
}
