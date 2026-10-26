import { IsNotEmpty, IsString, IsNumber, Min, Max, IsDateString, IsIn, IsOptional } from 'class-validator';
import type { CampaignType } from '../utils/campaign-pricing.util';

export class CreateCampaignDto {
  @IsNotEmpty()
  @IsString()
  occasion: string;

  @IsOptional()
  @IsIn(['DISCOUNT', 'SURCHARGE'])
  type?: CampaignType;

  // Giới hạn chi tiết theo loại (giảm tối đa 90%, phụ thu tối đa 100%) kiểm tra ở service.
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(100)
  discountPercent: number;

  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @IsNotEmpty()
  @IsDateString()
  endDate: string;
}
