import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { FitPreference } from './size-chart.dto';

export class SizeRecommendationDto {
  @IsOptional() @IsNumber() @Min(1) @Max(300) height?: number | null;
  @IsOptional() @IsNumber() @Min(1) @Max(1000) weight?: number | null;
  @IsOptional() @IsNumber() @Min(1) @Max(300) chest?: number | null;
  @IsOptional() @IsNumber() @Min(1) @Max(300) waist?: number | null;
  @IsOptional() @IsNumber() @Min(1) @Max(300) hip?: number | null;
  @IsOptional() @IsNumber() @Min(1) @Max(300) shoulder?: number | null;
  @IsOptional() @IsNumber() @Min(1) @Max(300) bicep?: number | null;
  @IsOptional() @IsEnum(FitPreference) fitPreference?: FitPreference | null;
}
