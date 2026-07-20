import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
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

  @IsOptional()
  @IsString()
  material?: string;

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
