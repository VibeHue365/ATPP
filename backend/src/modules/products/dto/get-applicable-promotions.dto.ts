import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ApplicableCartItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  photographyPackageId?: string;

  @IsOptional()
  @IsString()
  providerId?: string;

  @IsIn(['PRODUCT', 'PHOTOGRAPHY_PACKAGE'])
  itemType: 'PRODUCT' | 'PHOTOGRAPHY_PACKAGE';

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  comboDiscountAmount?: number;
}

export class GetApplicablePromotionsDto {
  @IsString()
  @IsOptional()
  bookingType?: string; // 'AODAI_RENTAL', 'PHOTOGRAPHY', 'COMBO'

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplicableCartItemDto)
  items: ApplicableCartItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  travelFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  serviceFee?: number;
}
