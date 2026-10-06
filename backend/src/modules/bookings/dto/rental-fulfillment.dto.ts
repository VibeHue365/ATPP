import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { RentalInventoryStatus } from '../schemas/rental-fulfillment.types';

export class RentalEvidenceDto {
  @IsArray({ message: 'Danh sách ảnh bằng chứng không hợp lệ.' })
  @ArrayMinSize(1, { message: 'Vui lòng cung cấp ít nhất 1 ảnh bằng chứng hiện trạng áo dài.' })
  @ArrayMaxSize(5, { message: 'Tối đa 5 ảnh bằng chứng cho mỗi lần bàn giao.' })
  @IsString({ each: true, message: 'Mỗi mã ảnh bằng chứng phải là một chuỗi ký tự.' })
  fileIds: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  conditionNote?: string;
}

export class MarkRentalReadyDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CompleteRentalFulfillmentDto {
  @IsEnum(RentalInventoryStatus)
  inventoryStatus: RentalInventoryStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
export class ProposeRentalChargeDto {
  @IsIn(['lateFee', 'damageFee', 'compensationAmount'])
  chargeType: 'lateFee' | 'damageFee' | 'compensationAmount';

  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  @MaxLength(1000)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ReviewRentalChargeDto {
  @IsBoolean()
  approved: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class SettleRentalDepositDto {
  @IsNumber()
  @Min(0)
  deductAmount: number;

  @IsEnum(RentalInventoryStatus)
  inventoryStatus: RentalInventoryStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}