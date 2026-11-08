import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleMobileLoginDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
