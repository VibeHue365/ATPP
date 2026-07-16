import { IsNotEmpty, IsString, IsNumber, Min, Max, IsDateString } from 'class-validator';

export class CreateCampaignDto {
  @IsNotEmpty()
  @IsString()
  occasion: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(90)
  discountPercent: number;

  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @IsNotEmpty()
  @IsDateString()
  endDate: string;
}
