import {
  ArrayMaxSize,
  IsArray,
  ArrayUnique,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  MinLength,
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
  @ArrayMaxSize(10)
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
  @ArrayMaxSize(10)
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

  @IsInt({ message: 'Giá thuê ngày phải là số nguyên (VNĐ)' })
  @Min(1, { message: 'Giá thuê ngày phải lớn hơn 0đ' })
  basePrice: number;

  @IsOptional()
  @IsInt({ message: 'Giá thuê theo giờ phải là số nguyên (VNĐ)' })
  @Min(10000, { message: 'Giá thuê theo giờ tối thiểu là 10.000đ' })
  @Max(2500000, { message: 'Giá thuê theo giờ tối đa là 2.500.000đ' })
  hourlyPrice?: number;

  @IsInt({ message: 'Tiền đặt cọc phải là số nguyên (VNĐ)' })
  @Min(0, { message: 'Tiền đặt cọc không được âm' })
  @Max(5000000, { message: 'Tiền đặt cọc tối đa là 5.000.000đ' })
  depositAmount: number;

  @IsOptional()
  @IsInt({ message: 'Giá trị bồi hoàn trang phục phải là số nguyên (VNĐ)' })
  @Min(100000, { message: 'Giá trị bồi hoàn trang phục tối thiểu là 100.000đ' })
  @Max(50000000, { message: 'Giá trị bồi hoàn trang phục tối đa là 50.000.000đ' })
  replacementValue?: number;

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
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique((tag: string) => tag.trim().toLocaleLowerCase('vi-VN'))
  @IsString({ each: true })
  @MinLength(2, { each: true })
  @MaxLength(30, { each: true })
  customTags?: string[];

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
