import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProviderCapability } from '../schemas/provider.schema';

export class ProviderRentalPickupLocationDto {
  @IsString()
  addressLine: string;

  @IsOptional()
  @IsString()
  ward?: string | null;

  @IsOptional()
  @IsString()
  district?: string | null;

  @IsOptional()
  @IsString()
  city?: string | null;

  @IsOptional()
  @IsObject()
  geo?: { type: 'Point'; coordinates: [number, number] } | null;
}

export class ProviderRentalSettingsDto {
  @IsOptional()
  @IsBoolean()
  useBusinessAddressForPickup?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProviderRentalPickupLocationDto)
  pickupLocation?: ProviderRentalPickupLocationDto | null;

  @IsOptional()
  @IsInt({ message: 'turnaroundSlots must be an integer' })
  @Min(0, { message: 'turnaroundSlots minimum is 0' })
  @Max(3, { message: 'turnaroundSlots maximum is 3' })
  turnaroundSlots?: number;
}

export class UpdateProviderProfileDto {
  @IsString()
  @IsOptional()
  businessName?: string;

  @IsArray()
  @IsEnum(ProviderCapability, { each: true })
  @IsOptional()
  capabilities?: ProviderCapability[];

  @IsOptional()
  contact?: {
    email: string;
    phone: string;
    website?: string | null;
  };

  @IsOptional()
  address?: {
    addressLine: string;
    ward?: string | null;
    district?: string | null;
    city?: string | null;
    geo?: { type: 'Point'; coordinates: [number, number] } | null;
  };

  @IsOptional()
  policies?: {
    cancellationPolicy?: string | null;
    rentalPolicy?: string | null;
  };

  @IsOptional()
  @ValidateNested()
  @Type(() => ProviderRentalSettingsDto)
  rentalSettings?: ProviderRentalSettingsDto;

  @IsOptional()
  @IsObject()
  photographySettings?: {
    serviceRadiusKm?: number | null;
    maxConcurrentSessions?: number | null;
    maxDailySessions?: number | null;
  };

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  comboDiscountPercent?: number;

  @IsOptional()
  @IsObject()
  media?: {
    logoUrl?: string | null;
    coverUrl?: string | null;
    images?: string[];
  };
}

export class AddPortfolioImageDto {
  @IsString()
  @IsNotEmpty()
  imageUrl: string;
}
