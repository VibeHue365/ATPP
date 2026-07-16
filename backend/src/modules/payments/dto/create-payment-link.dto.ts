import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { PaymentPurpose } from '../schemas/payment.schema';

export class CreatePaymentLinkDto {
  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @IsEnum(PaymentPurpose)
  purpose: PaymentPurpose;
}
