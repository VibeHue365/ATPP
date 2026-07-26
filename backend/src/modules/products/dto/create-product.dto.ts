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
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductStatus } from '../schemas/product.schema';
import { ConditionStatus } from '../schemas/inventory-item.schema';

export class ProductVariantDto {
  @IsString()
  @IsNotEmpty()
  size: string;

  @IsString()
  @IsNotEmpty()
  color: string;

  @IsOptional()
  @IsString()
  material?: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsEnum(ConditionStatus)
  conditionStatus?: ConditionStatus;
}

export class ColorImagesDto {
  @IsString()
  @IsNotEmpty()
  color: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

export class CreateProductDto {
  @IsMongoId()
  categoryId: string;

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
  name: string;

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

  // Ảnh theo màu. Mọi URL ở đây cũng phải có mặt trong `images` (kho hợp nhất) —
  // xem ghi chú ở product.schema.ts. Optional nên client cũ gửi thiếu vẫn chạy bình thường.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColorImagesDto)
  colorImages?: ColorImagesDto[];

  @IsNumber()
  @Min(0)
  basePrice: number;

  @IsNumber()
  @Min(0)
  depositAmount: number;

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

  // New: full variant list (size + color + material + quantity). When provided,
  // product.sizes/colors/materials are derived from it and inventory items are
  // created per variant. Replaces the old separate "nhập kho" step at onboarding.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];

  // Deprecated: kept for backward compatibility with the old create flow.
  @IsOptional()
  @IsNumber()
  @Min(1)
  initialQuantity?: number;
}
