import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';

export enum OverviewPeriod {
  Week = 'week',
  Month = 'month',
  Year = 'year',
}

export enum OverviewServiceFilter {
  All = 'all',
  AoDaiRental = 'AODAI_RENTAL',
  Photography = 'PHOTOGRAPHY',
  Combo = 'COMBO',
}

export class ProviderOverviewQueryDto {
  @IsOptional()
  @IsEnum(OverviewPeriod)
  period?: OverviewPeriod = OverviewPeriod.Month;

  @IsOptional()
  @IsEnum(OverviewServiceFilter)
  service?: OverviewServiceFilter = OverviewServiceFilter.All;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month phải có định dạng YYYY-MM (ví dụ: 2026-09)',
  })
  month?: string;
}

