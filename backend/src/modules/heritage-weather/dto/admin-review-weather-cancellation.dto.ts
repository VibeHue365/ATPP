import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CancellationReviewStatus } from '../schemas/weather-cancellation.schema';

export class AdminReviewWeatherCancellationDto {
  @IsEnum(CancellationReviewStatus, {
    message: 'Quyết định phê duyệt phải là APPROVED_FULL_REFUND, APPROVED_PARTIAL_REFUND hoặc REJECTED.',
  })
  @IsNotEmpty({ message: 'Quyết định phê duyệt không được để trống.' })
  decision: CancellationReviewStatus;

  @IsNumber({}, { message: 'Số tiền hoàn phải là số hợp lệ.' })
  @Min(0, { message: 'Số tiền hoàn không được âm.' })
  @IsOptional()
  approvedRefundAmount?: number;

  @IsNumber({}, { message: 'Số tiền phạt khấu trừ phải là số hợp lệ.' })
  @Min(0, { message: 'Số tiền phạt khấu trừ không được âm.' })
  @IsOptional()
  penaltyDeducted?: number;

  @IsString({ message: 'Ghi chú của admin phải là chuỗi.' })
  @IsOptional()
  notes?: string;
}
