import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PolicyCode } from '../constants/policy-code.enum';
import { PolicyStatus } from '../constants/policy-status.enum';
import { PolicyType } from '../constants/policy-type.enum';

export class CreateSystemPolicyDto {
  @IsEnum(PolicyCode)
  code: PolicyCode;

  @IsEnum(PolicyType)
  type: PolicyType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsObject()
  value: Record<string, unknown>;
}

export class UpdateSystemPolicyDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsObject()
  value?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class ActivatePolicyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason: string;
}

export class DeactivatePolicyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason: string;
}

export class QuerySystemPoliciesDto {
  @IsOptional()
  @IsEnum(PolicyCode)
  code?: PolicyCode;

  @IsOptional()
  @IsEnum(PolicyType)
  type?: PolicyType;

  @IsOptional()
  @IsEnum(PolicyStatus)
  status?: PolicyStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
