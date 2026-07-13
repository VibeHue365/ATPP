import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';

export class UpdateRolePermissionsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  permissions: string[];

  @IsString()
  @MaxLength(300)
  reason: string;
}
