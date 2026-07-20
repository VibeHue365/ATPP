import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { ProductModerationStatus } from '../schemas/product.schema';

export class ModerateProductDto {
  @IsEnum(ProductModerationStatus)
  action: ProductModerationStatus;

  @ValidateIf((dto: ModerateProductDto) =>
    dto.action === ProductModerationStatus.Rejected ||
    dto.action === ProductModerationStatus.Hidden,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason?: string;
}

export class QueryModerationProductsDto {
  @IsOptional()
  @IsEnum(ProductModerationStatus)
  status?: ProductModerationStatus;
}
