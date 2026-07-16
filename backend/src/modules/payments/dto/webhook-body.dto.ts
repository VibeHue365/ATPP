import { IsNotEmpty, IsString } from 'class-validator';

export class WebhookBodyDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  desc: string;

  @IsNotEmpty()
  data: Record<string, unknown>;

  @IsString()
  @IsNotEmpty()
  signature: string;
}
