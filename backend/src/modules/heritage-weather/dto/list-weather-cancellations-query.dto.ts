import { IsEnum, IsInt, IsMongoId, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CancellationReviewStatus } from '../schemas/weather-cancellation.schema';

export class ListWeatherCancellationsQueryDto {
  @IsEnum(CancellationReviewStatus, {
    message: 'Trạng thái lọc không hợp lệ.',
  })
  @IsOptional()
  status?: CancellationReviewStatus;

  @IsMongoId({ message: 'Mã đơn hàng lọc không hợp lệ.' })
  @IsOptional()
  bookingId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
