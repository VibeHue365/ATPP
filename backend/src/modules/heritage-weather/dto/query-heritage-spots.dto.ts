import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { HeritageSpotSpaceType } from '../schemas/heritage-spot.schema';

export class QueryHeritageSpotsDto {
  @ApiPropertyOptional({
    description: 'Vĩ độ người dùng hoặc điểm tham chiếu (Latitude)',
    example: 16.4637,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({
    description: 'Kinh độ người dùng hoặc điểm tham chiếu (Longitude)',
    example: 107.5909,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({
    description: 'Bán kính tìm kiếm di tích tính theo Kilômét',
    example: 15,
    default: 25,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(100)
  radiusKm?: number = 25;

  @ApiPropertyOptional({
    description: 'Lọc theo loại không gian bối cảnh',
    enum: HeritageSpotSpaceType,
    example: HeritageSpotSpaceType.SEMI_INDOOR,
  })
  @IsOptional()
  @IsEnum(HeritageSpotSpaceType)
  spaceType?: HeritageSpotSpaceType;

  @ApiPropertyOptional({
    description: 'Lọc theo nhãn tag đặc trưng',
    example: 'HOANG_CUNG',
  })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({
    description: 'Tìm kiếm tự do theo tên hoặc địa chỉ di tích',
    example: 'Khải Định',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
