import { IsNotEmpty, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CaptureProposalPaymentDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  orderCode: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;
}
