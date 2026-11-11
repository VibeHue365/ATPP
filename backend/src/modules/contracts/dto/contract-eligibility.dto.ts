import { IsArray, IsMongoId, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class EligibilityCheckItemDto {
  @IsMongoId()
  productId: string;

  @IsOptional()
  providerId?: string;
}

export class CheckContractEligibilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EligibilityCheckItemDto)
  items: EligibilityCheckItemDto[];
}
