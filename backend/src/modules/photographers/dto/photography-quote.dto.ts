import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsMongoId,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
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

  /** Exact shoot pin supplied by the map. Both coordinates must be provided together. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  locationLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  locationLongitude?: number;
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
