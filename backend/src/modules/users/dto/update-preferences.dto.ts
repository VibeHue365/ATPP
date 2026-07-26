import { IsOptional, IsBoolean, IsObject, IsArray, IsString, IsNumber } from 'class-validator';
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
  @IsString({ each: true })
  preferredAoDaiStyles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredPhotographyStyles?: string[];

  @IsOptional()
  @IsObject()
  @Type(() => SizeInfoDto)
  sizeInfo?: SizeInfoDto;

  @IsOptional()
  @IsObject()
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
}

export class UpdatePreferencesDto {
  @IsOptional()
  @IsBoolean()
  hasCompletedOnboarding?: boolean;

  @IsOptional()
  @IsObject()
  @Type(() => UserPreferencesDto)
  preferences?: UserPreferencesDto;
}
