import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ProductModerationStatus } from '../schemas/product.schema';

export class ModerateProductDto {
  @IsEnum(ProductModerationStatus)
  action: ProductModerationStatus;

  @ValidateIf(
    (dto: ModerateProductDto) =>
      dto.action === ProductModerationStatus.Rejected ||
      dto.action === ProductModerationStatus.Hidden,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason?: string;

  /** Custom tags selected in the existing product-approval dialog. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique((tag: string) => tag.trim().toLocaleLowerCase('vi-VN'))
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  approvedCustomTags?: string[];
}

export class QueryModerationProductsDto {
  @IsOptional()
  @IsEnum(ProductModerationStatus)
  status?: ProductModerationStatus;
}
