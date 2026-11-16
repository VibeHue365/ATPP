import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { ProposalChangeType } from '../schemas/weather-proposal.schema';

export class CreateWeatherProposalDto {
  @IsNotEmpty()
  @IsEnum(ProposalChangeType)
  changeType: ProposalChangeType;

  @IsOptional()
  @IsString()
  proposedSpotId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'proposedDate must be in the format YYYY-MM-DD',
  })
  proposedDate?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}-\d{2}:\d{2}$/, {
    message: 'proposedTimeSlot must be in the format HH:mm-HH:mm (e.g. 09:00-11:00)',
  })
  proposedTimeSlot?: string;

  @IsOptional()
  @IsString()
  customerReason?: string;
}
