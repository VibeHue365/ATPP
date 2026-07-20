import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { RentalInventoryStatus } from '../schemas/rental-fulfillment.types';

export class RentalEvidenceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsString({ each: true })
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