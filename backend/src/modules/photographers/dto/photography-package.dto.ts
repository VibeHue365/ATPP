import {
  IsArray,
  ArrayUnique,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PackageStatus,
  PhotographyPricingUnit,
} from '../../products/schemas/photography-package.schema';

export class CreatePhotographyPackageDto {
  @IsOptional()
  @IsMongoId()
  categoryId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  conceptCategoryIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  styleCategoryIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  eventCategoryIds?: string[];
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0.5)
  durationHours: number;
  @IsOptional()
  @IsEnum(PhotographyPricingUnit)
  pricingUnit?: PhotographyPricingUnit;

  @IsOptional()
  @IsInt()
  @Min(30)
  includedDurationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  includedSessionCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  includedDayCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  additionalSessionFee?: number;

  @IsInt()
  @Min(0)
  editedPhotosCount: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  rawPhotosCount?: number;

  @IsInt()
  @Min(0)
  deliveryDays: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  travelFeeNotes?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  overtimeFeePerHour?: number;
  @IsOptional()
  @IsInt()
  @Min(30)
  overtimeIncrementMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxOvertimeMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bufferBeforeMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bufferAfterMinutes?: number;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images?: string[];

  @IsOptional()
  @IsEnum(PackageStatus)
  status?: PackageStatus;
}

export class UpdatePhotographyPackageDto {
  @IsOptional()
  @IsMongoId()
  categoryId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  conceptCategoryIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  styleCategoryIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  eventCategoryIds?: string[];
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  durationHours?: number;
  @IsOptional()
  @IsEnum(PhotographyPricingUnit)
  pricingUnit?: PhotographyPricingUnit;

  @IsOptional()
  @IsInt()
  @Min(30)
  includedDurationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  includedSessionCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  includedDayCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  additionalSessionFee?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  editedPhotosCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  rawPhotosCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  deliveryDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  travelFeeNotes?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  overtimeFeePerHour?: number;
  @IsOptional()
  @IsInt()
  @Min(30)
  overtimeIncrementMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxOvertimeMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bufferBeforeMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bufferAfterMinutes?: number;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images?: string[];

  @IsOptional()
  @IsEnum(PackageStatus)
  status?: PackageStatus;
}
