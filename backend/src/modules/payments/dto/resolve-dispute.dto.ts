import { IsNumber, Min } from 'class-validator';

export class ResolveDisputeDto {
  @IsNumber()
  @Min(0)
  refundToCustomer: number;

  @IsNumber()
  @Min(0)
  payToProvider: number;
}
