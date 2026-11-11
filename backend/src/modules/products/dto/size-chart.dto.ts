import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export enum ChartSource {
  Manual = 'MANUAL',
  Image = 'IMAGE',
}
export enum MeasurementType {
  Body = 'BODY',
  Garment = 'GARMENT',
}
export enum FitPreference {
  Slim = 'SLIM',
  Regular = 'REGULAR',
  Comfort = 'COMFORT',
}
export const CIRCUMFERENCES = ['chest', 'waist', 'hip'] as const;
export const OPTIONAL_FIT_DIMENSIONS = ['shoulder', 'bicep'] as const;
export const FIT_DIMENSIONS = [...CIRCUMFERENCES, ...OPTIONAL_FIT_DIMENSIONS] as const;
export const MEASUREMENTS = [
  ...FIT_DIMENSIONS,
  'height',
  'weight',
  'length',
] as const;
export type MeasurementKey = (typeof MEASUREMENTS)[number];

export class MeasurementRangeDto {
  @IsNumber() @Min(0.01) @Max(1000) min: number;
  @IsNumber() @Min(0.01) @Max(1000) max: number;
}

export class SizeChartRowDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MaxLength(30)
  size: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => MeasurementRangeDto)
  chest?: MeasurementRangeDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => MeasurementRangeDto)
  waist?: MeasurementRangeDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => MeasurementRangeDto)
  hip?: MeasurementRangeDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => MeasurementRangeDto)
  shoulder?: MeasurementRangeDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => MeasurementRangeDto)
  bicep?: MeasurementRangeDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => MeasurementRangeDto)
  height?: MeasurementRangeDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => MeasurementRangeDto)
  weight?: MeasurementRangeDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => MeasurementRangeDto)
  length?: MeasurementRangeDto;
}

// Effective allowance = garment circumference - body circumference, in cm.
// Negative minimum is allowed only with explicitly declared stretch capacity.
export class EaseRangeDto {
  @IsNumber() @Min(-100) @Max(100) min: number;
  @IsNumber() @Min(-100) @Max(100) max: number;
}
export class GarmentFitRuleDto {
  @IsEnum(FitPreference) preference: FitPreference;
  @IsOptional()
  @ValidateNested()
  @Type(() => EaseRangeDto)
  chest?: EaseRangeDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => EaseRangeDto)
  waist?: EaseRangeDto;
  @IsOptional() @ValidateNested() @Type(() => EaseRangeDto) hip?: EaseRangeDto;
  @IsOptional() @ValidateNested() @Type(() => EaseRangeDto) shoulder?: EaseRangeDto;
  @IsOptional() @ValidateNested() @Type(() => EaseRangeDto) bicep?: EaseRangeDto;
}
export class StretchAllowanceDto {
  @IsOptional() @IsNumber() @Min(0) @Max(100) chest?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) waist?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) hip?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) shoulder?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) bicep?: number;
}
export class ChartVersionDto {
  @IsInt() @Min(0) expectedVersion: number;
}

export class SizeChartImageDto extends ChartVersionDto {
  @Type(() => Number) @IsInt() @Min(0) declare expectedVersion: number;
  @IsEnum(MeasurementType) measurementType: MeasurementType;
  @IsEnum(['CM', 'IN']) lengthUnit: 'CM' | 'IN';
  @IsEnum(['KG', 'LB']) weightUnit: 'KG' | 'LB';
}
export class SaveSizeChartDto extends ChartVersionDto {
  @IsEnum(ChartSource) source: ChartSource;
  @IsEnum(MeasurementType) measurementType: MeasurementType;
  @IsEnum(['CM', 'IN']) lengthUnit: 'CM' | 'IN';
  @IsEnum(['KG', 'LB']) weightUnit: 'KG' | 'LB';
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  imageUrl?: string;
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique((row: SizeChartRowDto) => row.size)
  @ValidateNested({ each: true })
  @Type(() => SizeChartRowDto)
  rows: SizeChartRowDto[];
  // Required fields must be present in every confirmed row. No inferred defaults.
  @IsArray()
  @ArrayUnique()
  @IsEnum(['chest', 'waist', 'hip', 'shoulder', 'bicep', 'height', 'weight'], { each: true })
  requiredMeasurements: Array<Exclude<MeasurementKey, 'length'>>;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique((rule: GarmentFitRuleDto) => rule.preference)
  @ValidateNested({ each: true })
  @Type(() => GarmentFitRuleDto)
  fitRules?: GarmentFitRuleDto[];
  @IsOptional()
  @ValidateNested()
  @Type(() => StretchAllowanceDto)
  stretchAllowanceCm?: StretchAllowanceDto;
}
