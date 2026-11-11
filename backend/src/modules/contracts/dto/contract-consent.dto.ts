import {
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ContractConsentAction } from '../schemas/contract-consent.schema';

export class ContractConsentDto {
  @IsMongoId()
  contractVersionId: string;

  @IsEnum(ContractConsentAction)
  action: ContractConsentAction;

  @Matches(/^[a-f0-9]{64}$/)
  contentHash: string;

  @Matches(/^[a-f0-9]{64}$/)
  bookingFingerprint: string;

  @IsString()
  @MinLength(8)
  @MaxLength(160)
  idempotencyKey: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  presentationMode?: string;
}

export class ProviderAcceptMechanismDto {
  @Matches(/^[a-f0-9]{64}$/)
  mechanismHash: string;
}
