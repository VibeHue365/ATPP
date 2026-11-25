import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export type StaffScheduleScope = 'today' | 'upcoming' | 'completed' | 'all';

export class StaffSchedulesQueryDto {
  @IsOptional()
  @IsIn(['today', 'upcoming', 'completed', 'all'])
  scope?: StaffScheduleScope;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Ngày bắt đầu phải theo định dạng YYYY-MM-DD',
  })
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Ngày kết thúc phải theo định dạng YYYY-MM-DD',
  })
  to?: string;
}

export class StaffCheckInDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}

export class StaffFinishShootDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CreateStaffBlockedSlotDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Ngày bận phải theo định dạng YYYY-MM-DD',
  })
  date: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Giờ bắt đầu phải theo định dạng HH:mm',
  })
  startTime?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Giờ kết thúc phải theo định dạng HH:mm',
  })
  endTime?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string | null;
}
