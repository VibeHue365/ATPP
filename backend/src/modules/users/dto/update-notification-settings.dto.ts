import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  marketingEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  appPush?: boolean;
}
