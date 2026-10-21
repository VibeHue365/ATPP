import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { BannerPlacement } from '../schemas/banner.schema';

export class UpdateBannerDto {
  @IsEnum(BannerPlacement)
  @IsNotEmpty()
  placement: BannerPlacement;

  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  subtitle?: string;

  @IsString()
  @IsOptional()
  linkUrl?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
