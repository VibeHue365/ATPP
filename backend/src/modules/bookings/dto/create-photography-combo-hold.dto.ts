import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreatePhotographyHoldDto } from './create-photography-hold.dto';

export class ComboAoDaiHoldItemDto {
  @IsMongoId()
  productId: string;

  @IsString()
  @MaxLength(20)
  selectedSize: string;

  @IsString()
  @MaxLength(40)
  selectedColor: string;

  @IsDateString()
  rentalFrom: string;

  @IsDateString()
  rentalTo: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  quantity?: number;
}

/** Creates a photo and Ao Dai reservation as one all-or-nothing hold. */
export class CreatePhotographyComboHoldDto extends CreatePhotographyHoldDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ComboAoDaiHoldItemDto)
  aodaiItems: ComboAoDaiHoldItemDto[];

  @IsOptional()
  @IsNumber()
  comboDiscountPercent?: number;

  @IsOptional()
  @IsMongoId()
  comboPromotionId?: string;
}
