import { ArrayMaxSize, IsArray, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateRolePermissionsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  permissions: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  reason: string;
}
