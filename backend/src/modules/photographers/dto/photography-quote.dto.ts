import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class PhotographyQuoteSessionDto {
  /** Client-only stable id used to attach validation errors to a form row. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  clientId: string;

  /** ISO-8601 date-time with an explicit timezone offset. */
  @IsString()
  @IsDateString()
  startsAt: string;

  /** ISO-8601 date-time with an explicit timezone offset. */
  @IsString()
  @IsDateString()
  endsAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  locationAddress?: string;
}

export class CreatePhotographyQuoteDto {
  @IsMongoId()
  packageId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PhotographyQuoteSessionDto)
  sessions: PhotographyQuoteSessionDto[];
}
