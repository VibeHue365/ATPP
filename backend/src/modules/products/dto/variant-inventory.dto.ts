import { IsInt, IsMongoId, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

/** Khoá xác định một biến thể tồn kho: sản phẩm + size + màu + chất liệu. */
export class VariantKeyDto {
  @IsMongoId()
  productId: string;

  @IsString()
  @IsNotEmpty()
  size: string;

  @IsString()
  @IsNotEmpty()
  color: string;

  @IsOptional()
  @IsString()
  material?: string;
}

/** Đặt lại số lượng cho một biến thể — lớn hơn thì nhập thêm, nhỏ hơn thì thanh lý bớt, 0 là hết hàng. */
export class AdjustVariantQuantityDto extends VariantKeyDto {
  @IsInt()
  @Min(0)
  @Max(100)
  targetQuantity: number;
}
