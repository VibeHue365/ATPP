import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ProviderStaffStatus } from '../schemas/provider-staff.schema';

export class CreateProviderStaffDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên thợ chụp' })
  @MaxLength(120)
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập số điện thoại liên hệ' })
  @MaxLength(30)
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  avatarUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  specialty?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  bio?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  experienceYears?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  internalNote?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  createAccount?: boolean;

  @IsOptional()
  @IsEmail({}, { message: 'Email đăng nhập không hợp lệ' })
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(128)
  password?: string;
}

export class UpdateProviderStaffDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  avatarUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  specialty?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  bio?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  experienceYears?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  internalNote?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateProviderStaffStatusDto {
  @IsEnum(ProviderStaffStatus)
  status: ProviderStaffStatus;
}

export class AddProviderStaffBlockDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Ngày nghỉ phải theo định dạng YYYY-MM-DD',
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

export class UpdateProviderCapacityDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
  })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt({ message: 'Số ca đồng thời phải là số nguyên' })
  @Min(1, { message: 'Số ca đồng thời tối thiểu là 1' })
  @Max(30, { message: 'Số ca đồng thời tối đa là 30' })
  maxConcurrentSessions?: number | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
  })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt({ message: 'Số ca tối đa trong ngày phải là số nguyên' })
  @Min(1, { message: 'Số ca tối đa trong ngày phải từ 1 trở lên' })
  @Max(100, { message: 'Số ca tối đa trong ngày không vượt quá 100' })
  maxDailySessions?: number | null;
}

export class ProvisionStaffAccountDto {
  @IsEmail({}, { message: 'Email đăng nhập không hợp lệ' })
  @MaxLength(200)
  email: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(128)
  password?: string;
}

export class ResetStaffPasswordDto {
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới tối thiểu 8 ký tự' })
  @MaxLength(128)
  newPassword?: string;
}

export class ToggleStaffAccountLockDto {
  @Type(() => Boolean)
  @IsBoolean({ message: 'Trường locked phải là boolean' })
  locked: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
