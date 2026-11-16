import { IsArray, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class SubmitWeatherCancellationDto {
  @IsString()
  @IsNotEmpty({ message: 'Lý do hủy đơn không được để trống.' })
  @MinLength(10, { message: 'Lý do hủy đơn phải có ít nhất 10 ký tự.' })
  reason: string;

  @IsArray({ message: 'Danh sách ảnh bằng chứng phải là một mảng.' })
  @IsString({ each: true, message: 'Đường dẫn ảnh bằng chứng phải là chuỗi URL.' })
  @IsOptional()
  evidencePhotos?: string[];
}
