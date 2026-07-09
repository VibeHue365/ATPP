import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ConditionStatus, InventoryItemStatus } from '../schemas/inventory-item.schema';

export class UpdateInventoryItemDto {
  @IsOptional()
  @IsEnum(ConditionStatus)
  conditionStatus?: ConditionStatus;

  @IsOptional()
  @IsEnum(InventoryItemStatus)
  status?: InventoryItemStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
