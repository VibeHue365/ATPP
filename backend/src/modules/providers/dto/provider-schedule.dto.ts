import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ScheduleCapability } from '../../products/schemas/provider-schedule.schema';

export class RecurringScheduleDto {
  @IsNumber()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsArray()
  workingHours: Array<{ start: string; end: string }>;

  @IsOptional()
  @IsEnum(ScheduleCapability)
  capability?: ScheduleCapability;
}

export class BulkRecurringScheduleDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  dayOfWeeks: number[];

  @IsArray()
  @ArrayNotEmpty()
  workingHours: Array<{ start: string; end: string }>;

  @IsOptional()
  @IsEnum(ScheduleCapability)
  capability?: ScheduleCapability;
}

export class SpecificDateScheduleDto {
  @IsString()
  @IsNotEmpty()
  date: string;

  @IsBoolean()
  isOffDay: boolean;

  @IsArray()
  customSlots: Array<{ timeSlot: string; status: string }>;

  @IsOptional()
  @IsEnum(ScheduleCapability)
  capability?: ScheduleCapability;

  @IsOptional()
  @IsString()
  reason?: string;
}
