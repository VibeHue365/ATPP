import { IsDateString, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { HeritageSpotSpaceType } from '../schemas/heritage-spot.schema';

export class GetForecastDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsEnum(HeritageSpotSpaceType)
  spaceType?: HeritageSpotSpaceType;

  @IsOptional()
  @IsDateString()
  date?: string;
}
