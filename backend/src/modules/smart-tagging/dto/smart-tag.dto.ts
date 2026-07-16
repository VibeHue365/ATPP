import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  SmartTagDecisionAction,
  SmartTagEntityType,
} from '../constants/smart-tag.constants';

export class GenerateSmartTagsDto {
  @IsEnum(SmartTagEntityType)
  entityType: SmartTagEntityType;
}

export class SmartTagDecisionDto {
  @IsEnum(SmartTagDecisionAction)
  action: SmartTagDecisionAction;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedDecisionVersion: number;

  @ValidateIf(
    (dto: SmartTagDecisionDto) =>
      dto.action === SmartTagDecisionAction.Reject ||
      dto.action === SmartTagDecisionAction.Remove,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason?: string;
}

export class SmartTagSelectionDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(80, { each: true })
  activeTagCodes: string[];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedDecisionVersion: number;
}

export class SmartTagTaxonomyQueryDto {
  @IsOptional()
  @IsEnum(SmartTagEntityType)
  entityType?: SmartTagEntityType;
}
