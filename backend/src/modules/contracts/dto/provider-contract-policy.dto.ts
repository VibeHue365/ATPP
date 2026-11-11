import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  IncidentCompensationMethod,
  IncidentTierKey,
} from '../schemas/provider-contract-policy.schema';

export class GarmentCareDto {
  @IsBoolean()
  allowIroning: boolean;

  @IsBoolean()
  allowWashing: boolean;

  @IsArray()
  @IsString({ each: true })
  prohibitedActions: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialNotes?: string | null;
}

export class LateReturnDto {
  @IsInt()
  @Min(0)
  @Max(72)
  gracePeriodHours: number;

  @IsNumber()
  @Min(0)
  hourlyLateFee: number;

  @IsNumber()
  @Min(0)
  dailyLateFee: number;

  @IsInt()
  @Min(1)
  @Max(30)
  maxLateDaysAllowed: number;
}

export class TierCompensationRuleDto {
  @IsEnum(IncidentCompensationMethod)
  method: IncidentCompensationMethod;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedFeeAmount?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  percentageOfAsset?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  conditionsAndEvidence?: string | null;

  @IsOptional()
  @IsEnum(IncidentTierKey)
  tier?: IncidentTierKey | null;
}

export class DamageCompensationDto {
  // V2 Tier fields (optional on draft save, validated on review submission)
  @IsOptional()
  @ValidateNested()
  @Type(() => TierCompensationRuleDto)
  minorDamage?: TierCompensationRuleDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => TierCompensationRuleDto)
  moderateDamage?: TierCompensationRuleDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => TierCompensationRuleDto)
  severeDamage?: TierCompensationRuleDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => TierCompensationRuleDto)
  totalLoss?: TierCompensationRuleDto | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(72)
  incidentNotificationHours?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  disputeResolutionTerms?: string | null;

  // Legacy V1 fields (optional for backward compatibility)
  @IsOptional()
  @IsNumber()
  @Min(0)
  minorDamageFee?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  moderateDamagePercent?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  severeDamageOrLossPercent?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  disputeResolutionNotes?: string | null;
}

export class CancellationRefundRuleDto {
  @IsInt()
  @Min(0)
  daysBeforeRental: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  refundPercentage: number;
}

export class CancellationPolicyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CancellationRefundRuleDto)
  refundRules: CancellationRefundRuleDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancellationNotes?: string | null;
}

export class ProviderSupportContactDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  hotline: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  supportWorkingHours: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactNote?: string | null;
}

export class SaveProviderPolicyDraftDto {
  @ValidateNested()
  @Type(() => GarmentCareDto)
  garmentCare: GarmentCareDto;

  @ValidateNested()
  @Type(() => LateReturnDto)
  lateReturn: LateReturnDto;

  @ValidateNested()
  @Type(() => DamageCompensationDto)
  damageCompensation: DamageCompensationDto;

  @ValidateNested()
  @Type(() => CancellationPolicyDto)
  cancellationPolicy: CancellationPolicyDto;

  @ValidateNested()
  @Type(() => ProviderSupportContactDto)
  supportContact: ProviderSupportContactDto;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  customTermsText?: string | null;
}

export class AdminReviewPolicyDto {
  @IsEnum(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string | null;
}
