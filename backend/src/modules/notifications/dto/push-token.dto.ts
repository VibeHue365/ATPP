import { IsIn, IsString, Matches } from 'class-validator';

const EXPO_PUSH_TOKEN = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;

export class RegisterPushTokenDto {
  @IsString()
  @Matches(EXPO_PUSH_TOKEN)
  token: string;

  @IsIn(['android', 'ios'])
  platform: 'android' | 'ios';
}

export class UnregisterPushTokenDto {
  @IsString()
  @Matches(EXPO_PUSH_TOKEN)
  token: string;
}
