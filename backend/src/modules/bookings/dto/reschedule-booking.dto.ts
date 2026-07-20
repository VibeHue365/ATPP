import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class RescheduleBookingDto {
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @IsString()
  @IsOptional()
  newRentalFrom?: string;

  @IsString()
  @IsOptional()
  newRentalTo?: string;

  @IsString()
  @IsOptional()
  newShootDate?: string;

  @IsString()
  @IsOptional()
  newShootTimeSlot?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
