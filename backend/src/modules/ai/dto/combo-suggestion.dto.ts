import { IsNotEmpty, IsOptional, IsString, IsNumber, IsArray } from 'class-validator';

export class ProductInfoDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  materials?: string[];

  @IsOptional()
  @IsArray()
  colors?: string[];

  @IsOptional()
  @IsArray()
  sizes?: string[];

  @IsOptional()
  @IsNumber()
  basePrice?: number;

  @IsOptional()
  @IsArray()
  images?: string[];
}

export class PhotographyPackageInfoDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  durationMinutes?: number;

  @IsOptional()
  @IsNumber()
  maxPeople?: number;

  @IsOptional()
  @IsString()
  locationType?: string;

  @IsOptional()
  @IsArray()
  deliverables?: string[];

  @IsOptional()
  @IsArray()
  images?: string[];
}

export class ComboSuggestionRequestDto {
  product: ProductInfoDto;
  photography_package: PhotographyPackageInfoDto;

  @IsOptional()
  @IsString()
  vibe?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export interface ComboSuggestionResponseDto {
  name: string;
  description: string;
  suggested_discount_percent: number;
  suggested_price: number;
  suggested_shoot_people_count: number;
  suggested_aodai_quantity: number;
  concept_theme: string;
  target_audience: string;
  ideal_locations: string[];
  styling_tips: string[];
  marketing_highlights: string[];
  source: string;
}
