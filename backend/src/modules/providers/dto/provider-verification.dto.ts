import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProviderCapability } from '../schemas/provider.schema';
import { ProviderDocumentType } from '../schemas/provider-verification.schema';

export class CreateProviderVerificationDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @IsEnum(ProviderCapability, { each: true })
  requestedCapabilities: ProviderCapability[];
}

export class BusinessProfileDto {
  @IsString()
  @IsOptional()
  businessName?: string;

  @IsString()
  @IsOptional()
  ownerName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  province?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class AodaiInfoDto {
  @IsString()
  @IsOptional()
  shopName?: string;

  @IsString()
  @IsOptional()
  rentalPolicy?: string;

  @IsString()
  @IsOptional()
  depositPolicy?: string;

  @IsString()
  @IsOptional()
  pickupAddress?: string;

  @IsString()
  @IsOptional()
  sizeSupport?: string;
}

export class PhotographyInfoDto {
  @IsString()
  @IsOptional()
  studioName?: string;

  @IsString()
  @IsOptional()
  workingArea?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  photographyStyles?: string[];

  @IsArray()
  @IsUrl({}, { each: true })
  @IsOptional()
  portfolioUrls?: string[];
}

export class UpdateProviderVerificationDto {
  @ValidateNested()
  @Type(() => BusinessProfileDto)
  @IsOptional()
  businessProfile?: BusinessProfileDto;

  @ValidateNested()
  @Type(() => AodaiInfoDto)
  @IsOptional()
  aodaiInfo?: AodaiInfoDto;

  @ValidateNested()
  @Type(() => PhotographyInfoDto)
  @IsOptional()
  photographyInfo?: PhotographyInfoDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @IsEnum(ProviderCapability, { each: true })
  @IsOptional()
  requestedCapabilities?: ProviderCapability[];
}

export class AcceptProviderVerificationConsentDto {
  @IsString()
  @IsNotEmpty()
  version: string;
}

export class UploadProviderVerificationDocumentDto {
  @IsEnum(ProviderDocumentType)
  documentType: ProviderDocumentType;
}

export class AdminReviewDecisionDto {
  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
