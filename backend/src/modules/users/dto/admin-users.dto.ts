import {
  ArrayNotEmpty,
  IsDateString,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { UserStatus } from '../schemas/user.schema';

export enum UserRole {
  Customer = 'CUSTOMER',
  Provider = 'PROVIDER',
  Admin = 'ADMIN',
}

export class AdminListUsersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  keyword?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class UpdateUserRolesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(UserRole, { each: true })
  roles: UserRole[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  reason: string;
}

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  reason: string;
}

export enum AccountLockType {
  Suspended = 'SUSPENDED',
  Banned = 'BANNED',
}

export class LockUserDto {
  @IsEnum(AccountLockType)
  type: AccountLockType;

  @ValidateIf((dto: LockUserDto) => dto.type === AccountLockType.Suspended)
  @IsDateString()
  lockedUntil?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  reason: string;
}

export class UnlockUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  reason: string;
}
