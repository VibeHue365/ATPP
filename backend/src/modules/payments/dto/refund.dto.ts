import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { RefundMode } from '../schemas/refund-request.schema';

export class CreateRefundDto {
  @IsInt()
  @Min(1)
  amount: number;

  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ApproveRefundDto {
  @IsInt()
  @Min(1)
  amount: number;

  @IsInt()
  @Min(0)
  expectedVersion: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class RefundActionDto {
  @IsInt()
  @Min(0)
  expectedVersion: number;

  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ProcessRefundDto {
  @IsInt()
  @Min(0)
  expectedVersion: number;

  @IsOptional()
  @IsEnum(RefundMode)
  mode?: RefundMode;

  @IsOptional()
  @IsString()
  reference?: string;
}
