import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentPurpose } from '../schemas/payment.schema';

export class CreatePaymentLinkDto {
  @IsString()
  @IsOptional()
  bookingId?: string;

  @IsArray()
  @IsOptional()
  bookingIds?: string[];

  @IsEnum(PaymentPurpose)
  purpose: PaymentPurpose;
}
