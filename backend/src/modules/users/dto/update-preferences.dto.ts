import { IsOptional, IsBoolean, IsObject } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsBoolean()
  hasCompletedOnboarding?: boolean;

  @IsOptional()
  @IsObject()
  preferences?: any;
}
