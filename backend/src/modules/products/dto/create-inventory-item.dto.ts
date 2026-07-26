import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ConditionStatus, InventoryItemStatus } from '../schemas/inventory-item.schema';

export class CreateInventoryItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  size: string;

  @IsString()
  @IsNotEmpty()
  color: string;

  // Bắt buộc: chất liệu là một phần khoá của biến thể tồn kho (size + màu + chất liệu),
  // để trống sẽ tạo ra một biến thể "không chất liệu" tách rời không gộp được với hàng cùng loại.
  // Phải trim TRƯỚC khi kiểm tra vì @IsNotEmpty vẫn cho lọt chuỗi toàn khoảng trắng.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  material: string;

  @IsOptional()
  @IsEnum(ConditionStatus)
  conditionStatus?: ConditionStatus;

  @IsOptional()
  @IsEnum(InventoryItemStatus)
  status?: InventoryItemStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;
}
