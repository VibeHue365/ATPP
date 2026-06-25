import { IsString, MinLength } from 'class-validator';

export class OAuthExchangeDto {
  @IsString()
  @MinLength(20)
  code: string;
}
