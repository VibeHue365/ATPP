import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RespondWeatherProposalDto {
  @IsNotEmpty()
  @IsIn(['APPROVED', 'REJECTED'])
  decision: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
