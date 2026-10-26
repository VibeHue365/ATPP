import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PublicMediaService } from '../../storage/services/public-media.service';
import { SizeChartService } from './size-chart.service';
import {
  ChartSource,
  CIRCUMFERENCES,
  SaveSizeChartDto,
  SizeChartImageDto,
  SizeChartRowDto,
} from '../dto/size-chart.dto';

@Injectable()
export class SizeChartImageService {
  constructor(
    private readonly charts: SizeChartService,
    private readonly media: PublicMediaService,
    private readonly config: ConfigService,
  ) {}

  async uploadAndExtract(
    userId: string,
    productId: string,
    dto: SizeChartImageDto,
    file?: Express.Multer.File,
  ) {
    const current = await this.charts.getOwned(userId, productId);
    if (current.version !== dto.expectedVersion)
      throw new ConflictException(
        'Bảng size đã thay đổi. Hãy tải lại bảng trước khi chọn ảnh mới.',
      );
    if (!file?.buffer?.length || file.buffer.length > 8 * 1024 * 1024)
      throw new BadRequestException('Upload a size chart image up to 8 MB');
    let uploaded: { url: string } | undefined;
    let failureMessage =
      'Chưa trích xuất được bảng size. Bảng cũ được giữ nguyên; hãy thử lại sau hoặc nhập tay.';
    let savingExtraction = false;
    try {
      const response = await fetch(
        `${this.config.get<string>('AI_SERVICE_URL', 'http://127.0.0.1:8000')}/size-charts/extract`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: file.buffer.toString('base64'),
            mime_type: file.mimetype,
          }),
          signal: AbortSignal.timeout(90_000),
        },
      );
      if (!response.ok) {
        switch (response.status) {
          case 422:
            failureMessage = 'AI không đọc được bảng trong ảnh. Bảng cũ được giữ nguyên; hãy thử ảnh rõ hơn hoặc nhập tay.';
            break;
          case 429:
            failureMessage = 'Đã hết hạn mức AI đọc ảnh hôm nay. Bảng cũ được giữ nguyên; hãy thử lại sau khi hạn mức được đặt lại.';
            break;
          case 503:
            failureMessage = 'Gemini tạm quá tải hoặc không khả dụng (503). Ảnh mới chưa được lưu; bảng size cũ được giữ nguyên. Hãy thử lại sau hoặc nhập tay.';
            break;
          case 504:
            failureMessage = 'Gemini phản hồi quá thời gian (504). Ảnh mới chưa được lưu; bảng size cũ được giữ nguyên. Hãy thử lại sau hoặc nhập tay.';
            break;
          default:
            failureMessage = 'Dịch vụ AI tạm thời chưa xử lý được ảnh. Bảng cũ được giữ nguyên; hãy thử lại sau hoặc nhập tay.';
        }
        throw new ServiceUnavailableException();
      }
      const extracted = (await response.json()) as Record<string, unknown>;
      if (!Array.isArray(extracted.rows) || extracted.rows.length > 30) {
        failureMessage = 'AI trả bảng size không hợp lệ. Hãy thử lại ảnh hoặc nhập số đo bằng tay.';
        throw new BadRequestException();
      }
      const allRows = extracted.rows.map((row) =>
        plainToInstance(SizeChartRowDto, row),
      );
      if (
        (
          await Promise.all(
            allRows.map((row) =>
              validate(row, { whitelist: true, forbidNonWhitelisted: true }),
            ),
          )
        ).some((errors) => errors.length)
      ) {
        failureMessage = 'AI trả số đo không hợp lệ. Hãy thử lại ảnh hoặc nhập số đo bằng tay.';
        throw new BadRequestException();
      }
      // A printed chart commonly contains more sizes than this product offers.
      // Keep only the product's persisted variants instead of rejecting all OCR rows.
      const productSizes = new Set(
        current.sizes.map((size) => size.trim().toUpperCase()),
      );
      const rows = allRows.filter((row) => productSizes.has(row.size));
      const ignoredCount = allRows.length - rows.length;
      if (!rows.length) {
        failureMessage =
          'AI không tìm thấy size của sản phẩm trong ảnh. Hãy kiểm tra nhãn size trên ảnh hoặc nhập tay.';
        throw new BadRequestException();
      }
      // Unknown units must not be replaced by the provider form's selected unit.
      const numericKeys = [
        'chest',
        'waist',
        'hip',
        'shoulder',
        'bicep',
        'height',
        'length',
      ] as const;
      if (
        !['CM', 'IN'].includes(String(extracted.lengthUnit)) &&
        rows.some((row) => numericKeys.some((key) => row[key]))
      ) {
        failureMessage = 'AI chưa xác định được đơn vị chiều dài của ảnh. Hãy thử ảnh rõ hơn hoặc nhập tay.';
        throw new BadRequestException();
      }
      if (
        !['KG', 'LB'].includes(String(extracted.weightUnit)) &&
        rows.some((row) => row.weight)
      ) {
        failureMessage = 'AI chưa xác định được đơn vị cân nặng của ảnh. Hãy thử ảnh rõ hơn hoặc nhập tay.';
        throw new BadRequestException();
      }
      if (
        !rows.some(
          (row) => numericKeys.some((key) => row[key]) || row.weight,
        )
      ) {
        failureMessage =
          'AI tìm thấy size nhưng chưa đọc được khoảng số đo hợp lệ. Hãy kiểm tra ảnh hoặc nhập các khoảng bên dưới.';
        throw new BadRequestException();
      }
      // Suggest only measurements actually present in every persisted variant.
      // Provider can change this draft selection before the explicit confirmation.
      const coversEverySize = rows.length === productSizes.size;
      const completeCircles = coversEverySize
        ? CIRCUMFERENCES.filter((key) => rows.every((row) => row[key]))
        : [];
      const requiredMeasurements = completeCircles.length
        ? [...completeCircles]
        : coversEverySize && rows.every((row) => row.height && row.weight)
          ? (['height', 'weight'] as const)
          : [];
      // OCR failures must not create an orphan in public image storage.
      // The version check in saveDraft still protects the chart if another
      // provider action wins while extraction/upload is running.
      savingExtraction = true;
      uploaded = await this.media.uploadImage('size-charts', file);
      const payload: SaveSizeChartDto = {
        ...dto,
        source: ChartSource.Image,
        imageUrl: uploaded.url,
        expectedVersion: current.version,
        rows,
        lengthUnit:
          extracted.lengthUnit === 'CM' || extracted.lengthUnit === 'IN'
            ? extracted.lengthUnit
            : dto.lengthUnit,
        weightUnit:
          extracted.weightUnit === 'KG' || extracted.weightUnit === 'LB'
            ? extracted.weightUnit
            : dto.weightUnit,
        // Type is declared by provider; never silently change BODY to GARMENT based on OCR.
        requiredMeasurements: [...requiredMeasurements],
      };
      const warnings = Array.isArray(extracted.warnings)
        ? extracted.warnings
            .filter((v): v is string => typeof v === 'string')
            .slice(0, 30)
        : [];
      if (ignoredCount)
        warnings.push(
          `Đã bỏ qua ${ignoredCount} size trong ảnh vì sản phẩm không có biến thể tương ứng.`,
        );
      if (
        extracted.measurementType &&
        extracted.measurementType !== dto.measurementType
      )
        warnings.push(
          'Loại bảng AI đọc được khác lựa chọn của bạn. Hãy kiểm tra lại loại bảng trước khi xác nhận.',
        );
      // Only the server-side OCR path may save rows with a replaced image.
      // A database/write failure is not an OCR failure. Surface it to the UI.
      let saved: Awaited<ReturnType<SizeChartService['saveDraft']>>;
      try {
        saved = await this.charts.saveDraft(userId, productId, payload, true);
      } catch (error) {
        await this.media.deleteByUrl(uploaded.url).catch(() => undefined);
        throw error;
      }
      return { ...saved, sizes: current.sizes, warnings, extractionFailed: false };
    } catch (error) {
      if (error instanceof ConflictException || savingExtraction) throw error;
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError'))
        failureMessage = 'Đọc ảnh quá thời gian chờ. Bảng cũ được giữ nguyên; hãy thử lại sau hoặc nhập tay.';
      else if (error instanceof TypeError && /fetch failed/i.test(error.message))
        failureMessage = 'Không kết nối được dịch vụ AI đọc ảnh (cổng 8000). Bảng cũ được giữ nguyên; hãy khởi động ai-service rồi thử lại.';
      return {
        ...current,
        warnings: [failureMessage],
        extractionFailed: true,
      };
    }
  }
}
