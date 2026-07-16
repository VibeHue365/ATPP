import { ArrayMinSize, IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';
import { ProductModerationStatus } from '../../products/schemas/product.schema';

export class CreatePortfolioItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUrl({}, { each: true })
  images: string[];
}

export class UpdatePortfolioItemDto extends CreatePortfolioItemDto {}

export class ModeratePortfolioItemDto {
  @IsEnum(ProductModerationStatus)
  action: ProductModerationStatus;

  @ValidateIf((dto: ModeratePortfolioItemDto) => dto.action === ProductModerationStatus.Rejected || dto.action === ProductModerationStatus.Hidden)
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason?: string;
}
