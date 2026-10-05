import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class SizeInfoDto {
  @IsOptional()
  @IsNumber()
  height?: number | null;

  @IsOptional()
  @IsNumber()
  weight?: number | null;

  @IsOptional()
  @IsString()
  preferredSize?: string | null;

  @IsOptional()
  @IsString()
  bodyShape?: string | null;
}

class BudgetRangeDto {
  @IsOptional()
  @IsNumber()
  min?: number | null;

  @IsOptional()
  @IsNumber()
  max?: number | null;
}

class UserPreferencesDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stylePreferences?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  favoriteColors?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @IsIn(['SILK', 'VELVET', 'BROCADE', 'ORGANZA', 'LINEN'], { each: true })
  preferredMaterials?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredAoDaiStyles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredPhotographyStyles?: string[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SizeInfoDto)
  sizeInfo?: SizeInfoDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BudgetRangeDto)
  budgetRange?: BudgetRangeDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredLocations?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredOccasions?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdatePreferencesDto {
  @IsOptional()
  @IsBoolean()
  hasCompletedOnboarding?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UserPreferencesDto)
  preferences?: UserPreferencesDto;
}
