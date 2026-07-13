import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsMongoId, IsNotEmpty, IsString, Matches, MaxLength, Min, ValidateIf } from 'class-validator';

export class CreateIncidentDto {
  @IsMongoId() bookingId: string;
  @IsMongoId() bookingItemId: string;
  @IsString() @IsNotEmpty() @MaxLength(1000) description: string;
  @IsArray()
  @ArrayMaxSize(5)
  @Matches(/^(https?:\/\/|\/uploads\/dispute-evidence\/)/i, {
    each: true,
    message: 'Mỗi ảnh bằng chứng phải là URL hợp lệ',
  })
  evidencePhotos: string[];
  @Type(() => Number) @IsInt() @Min(1) requestedAmount: number;
  @IsIn(['MAINTENANCE', 'CLEANING']) actionType: 'MAINTENANCE' | 'CLEANING';
}

export class ResolveDisputeDto {
  @IsIn(['SHOP_RIGHT', 'CUSTOMER_RIGHT', 'SPLIT'])
  decision: 'SHOP_RIGHT' | 'CUSTOMER_RIGHT' | 'SPLIT';

  @IsString() @IsNotEmpty() @MaxLength(1000)
  notes: string;

  @ValidateIf((dto: ResolveDisputeDto) => dto.decision === 'SPLIT')
  @Type(() => Number) @IsInt() @Min(0)
  refundAmount?: number;

  @ValidateIf((dto: ResolveDisputeDto) => dto.decision === 'SPLIT')
  @Type(() => Number) @IsInt() @Min(0)
  compensationAmount?: number;
}
