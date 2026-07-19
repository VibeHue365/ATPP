import {
  IsArray,
  ArrayUnique,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ProductStatus } from '../schemas/product.schema';

export class UpdateProductDto {
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

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
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  videos?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sizes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  colors?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  materials?: string[];

  @IsOptional()
  @IsString()
  style?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  occasions?: string[];

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}
