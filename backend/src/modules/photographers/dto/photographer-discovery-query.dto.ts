import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const PHOTOGRAPHER_SORT_OPTIONS = [
  'rating_desc',
  'reviews_desc',
  'price_asc',
  'price_desc',
] as const;

export type PhotographerSortOption = (typeof PHOTOGRAPHER_SORT_OPTIONS)[number];

export class PhotographerDiscoveryQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  // Legacy smart-tag concept filter, kept for backwards compatible deep links.
  @IsOptional()
  @IsString()
  @MaxLength(80)
  concept?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  packageCategoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  conceptCategoryIds?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  styleCategoryIds?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  eventCategoryIds?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  location?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(5)
  minRating?: number;

  @IsOptional()
  @IsIn(PHOTOGRAPHER_SORT_OPTIONS)
  sort?: PhotographerSortOption;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  /** Customer search radius in kilometres. Applied together with provider radius. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(500)
  searchRadiusKm?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  limit?: number;
}