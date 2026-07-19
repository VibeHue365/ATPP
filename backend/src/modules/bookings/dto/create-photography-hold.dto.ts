import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreatePhotographyQuoteDto } from '../../photographers/dto/photography-quote.dto';

/**
 * Uses the exact session payload from the quote API. Monetary values are
 * intentionally absent: the server recalculates them before creating a hold.
 */
export class CreatePhotographyHoldDto extends CreatePhotographyQuoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  concept?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  customRequests?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  referenceImage?: string;
}
