import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { ProductModerationStatus } from '../schemas/product.schema';

export class ModerateProductDto {
  @IsEnum(ProductModerationStatus)
  action: ProductModerationStatus;

  @ValidateIf((dto: ModerateProductDto) =>
    dto.action === ProductModerationStatus.Rejected ||
    dto.action === ProductModerationStatus.Hidden ||
    dto.action === ProductModerationStatus.ChangesRequested,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason?: string;
}

export class QueryModerationProductsDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  itemType?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  providerId?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}
