import { IsBoolean, IsNotEmpty, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ChannelSettingsDto {
  @IsBoolean()
  email: boolean;

  @IsBoolean()
  app: boolean;
}

export class UpdateNotificationSettingsDto {
  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => ChannelSettingsDto)
  booking: ChannelSettingsDto;

  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => ChannelSettingsDto)
  finance: ChannelSettingsDto;

  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => ChannelSettingsDto)
  schedule: ChannelSettingsDto;

  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => ChannelSettingsDto)
  system: ChannelSettingsDto;
}
