import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ProviderCapability } from '../schemas/provider.schema';

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
  @IsObject()
  rentalSettings?: {
    useBusinessAddressForPickup?: boolean;
    pickupLocation?: {
      addressLine: string;
      ward?: string | null;
      district?: string | null;
      city?: string | null;
      geo?: { type: 'Point'; coordinates: [number, number] } | null;
    } | null;
  };

  @IsOptional()
  @IsObject()
  photographySettings?: {
    serviceRadiusKm?: number | null;
  };

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  comboDiscountPercent?: number;
}

export class AddPortfolioImageDto {
  @IsString()
  @IsNotEmpty()
  imageUrl: string;
}
