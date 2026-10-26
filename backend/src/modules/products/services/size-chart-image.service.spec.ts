import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import {
  ChartSource,
  MeasurementType,
  SizeChartImageDto,
} from '../dto/size-chart.dto';
import { SizeChartImageService } from './size-chart-image.service';

function setup() {
  const charts = {
    getOwned: jest
      .fn()
      .mockResolvedValue({ version: 0, sizeChart: null, sizes: ['M'] }),
    saveDraft: jest
      .fn()
      .mockImplementation((_u, _p, dto) =>
        Promise.resolve({
          version: dto.expectedVersion + 1,
          sizeChart: { ...dto, status: 'DRAFT' },
        }),
      ),
  };
  const media = {
    uploadImage: jest
      .fn()
      .mockResolvedValue({
        url: 'https://res.cloudinary.com/example/image/upload/new.png',
      }),
    deleteByUrl: jest.fn().mockResolvedValue(undefined),
  };
  const config = { get: jest.fn().mockReturnValue('http://127.0.0.1:8000') };
  const fetchMock = jest
    .spyOn(global, 'fetch')
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        lengthUnit: 'CM',
        weightUnit: null,
        rows: [{ size: 'M', chest: { min: 86, max: 89 } }],
        warnings: ['Kiểm tra lại'],
      }),
    } as Response);
  return {
    charts,
    media,
    fetchMock,
    service: new SizeChartImageService(
      charts as any,
      media as any,
      config as any,
    ),
  };
}
const dto: SizeChartImageDto = {
  expectedVersion: 0,
  measurementType: MeasurementType.Body,
  lengthUnit: 'CM',
  weightUnit: 'KG',
};
const file = {
  buffer: Buffer.from('image bytes'),
  mimetype: 'image/png',
} as Express.Multer.File;
afterEach(() => jest.restoreAllMocks());
describe('provider image extraction', () => {
  it('checks ownership before upload or a paid AI call', async () => {
    const { service, charts, media, fetchMock } = setup();
    charts.getOwned.mockRejectedValue(new ForbiddenException());
    await expect(service.uploadAndExtract('u', 'p', dto, file)).rejects.toThrow(
      ForbiddenException,
    );
    expect(media.uploadImage).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects stale versions without uploading', async () => {
    const { service, charts, media } = setup();
    charts.getOwned.mockResolvedValue({
      version: 1,
      sizeChart: null,
      sizes: ['M'],
    });
    await expect(service.uploadAndExtract('u', 'p', dto, file)).rejects.toThrow(
      ConflictException,
    );
    expect(media.uploadImage).not.toHaveBeenCalled();
  });
  it('saves extraction once as an unconfirmed draft after OCR succeeds', async () => {
    const { service, charts, fetchMock } = setup();
    const result = await service.uploadAndExtract('u', 'p', dto, file);
    expect(charts.saveDraft.mock.calls[0][2]).toMatchObject({
      rows: [{ size: 'M', chest: { min: 86, max: 89 } }],
      source: ChartSource.Image,
      expectedVersion: 0,
      requiredMeasurements: ['chest'],
    });
    expect(charts.saveDraft.mock.calls[0][3]).toBe(true);
    expect(charts.saveDraft).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      version: 1,
      sizes: ['M'],
      sizeChart: { status: 'DRAFT' },
      extractionFailed: false,
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://127.0.0.1:8000/size-charts/extract',
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({
      image_base64: file.buffer.toString('base64'),
      mime_type: 'image/png',
    });
  });
  it('fills only the selected product size from a multi-size image', async () => {
    const { service, charts, fetchMock } = setup();
    charts.getOwned.mockResolvedValue({
      version: 0,
      sizeChart: null,
      sizes: ['L'],
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        lengthUnit: 'CM',
        rows: [
          { size: 'S', chest: { min: 80, max: 83 } },
          { size: 'L', chest: { min: 90, max: 94 }, length: { min: 142, max: 142 } },
          { size: 'XL', chest: { min: 95, max: 99 } },
        ],
      }),
    } as Response);
    const result = await service.uploadAndExtract('u', 'p', dto, file);
    expect(result.extractionFailed).toBe(false);
    expect(result.sizes).toEqual(['L']);
    expect(charts.saveDraft.mock.calls[0][2].rows).toEqual([
      expect.objectContaining({ size: 'L', chest: { min: 90, max: 94 }, length: { min: 142, max: 142 } }),
    ]);
    expect(charts.saveDraft.mock.calls[0][2].requiredMeasurements).toEqual(['chest']);
    expect(result.warnings).toContain(
      'Đã bỏ qua 2 size trong ảnh vì sản phẩm không có biến thể tương ứng.',
    );
  });
  it('keeps declared áo dài shoulder and upper-arm ranges in the unconfirmed draft', async () => {
    const { service, charts, fetchMock } = setup();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ lengthUnit: 'CM', rows: [{
        size: 'M', chest: { min: 86, max: 89 }, shoulder: { min: 38, max: 40 }, bicep: { min: 27, max: 30 },
      }] }),
    } as Response);
    await service.uploadAndExtract('u', 'p', dto, file);
    expect(charts.saveDraft.mock.calls[0][2].rows[0]).toMatchObject({
      shoulder: { min: 38, max: 40 }, bicep: { min: 27, max: 30 },
    });
  });
  it('preselects only measurements complete in every product size', async () => {
    const { service, charts, fetchMock } = setup();
    charts.getOwned.mockResolvedValue({ version: 0, sizeChart: null, sizes: ['S', 'M'] });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        lengthUnit: 'CM',
        rows: [
          { size: 'S', chest: { min: 80, max: 84 }, waist: { min: 62, max: 66 } },
          { size: 'M', chest: { min: 84, max: 88 } },
        ],
      }),
    } as Response);
    await service.uploadAndExtract('u', 'p', dto, file);
    expect(charts.saveDraft.mock.calls[0][2].requiredMeasurements).toEqual(['chest']);
  });
  it('preselects all three complete body circumferences from the image', async () => {
    const { service, charts, fetchMock } = setup();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        lengthUnit: 'CM',
        rows: [{
          size: 'M',
          chest: { min: 84, max: 88 },
          waist: { min: 66, max: 70 },
          hip: { min: 90, max: 94 },
          length: { min: 140, max: 140 },
        }],
      }),
    } as Response);
    await service.uploadAndExtract('u', 'p', dto, file);
    expect(charts.saveDraft.mock.calls[0][2].requiredMeasurements).toEqual([
      'chest', 'waist', 'hip',
    ]);
  });
  it('uses height and weight only when both are complete and no body circumference is complete', async () => {
    const { service, charts, fetchMock } = setup();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        lengthUnit: 'CM',
        weightUnit: 'KG',
        rows: [{ size: 'M', height: { min: 160, max: 165 }, weight: { min: 50, max: 55 } }],
      }),
    } as Response);
    await service.uploadAndExtract('u', 'p', dto, file);
    expect(charts.saveDraft.mock.calls[0][2].requiredMeasurements).toEqual(['height', 'weight']);
  });
  it('keeps the existing chart when no extracted size matches the product', async () => {
    const { service, charts, fetchMock, media } = setup();
    charts.getOwned.mockResolvedValue({
      version: 0,
      sizeChart: null,
      sizes: ['L'],
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        lengthUnit: 'CM',
        rows: [{ size: 'S', chest: { min: 80, max: 83 } }],
      }),
    } as Response);
    const result = await service.uploadAndExtract('u', 'p', dto, file);
    expect(result.extractionFailed).toBe(true);
    expect(result.warnings[0]).toContain('không tìm thấy size');
    expect(charts.saveDraft).not.toHaveBeenCalled();
    expect(media.uploadImage).not.toHaveBeenCalled();
    expect(media.deleteByUrl).not.toHaveBeenCalled();
  });
  it('keeps the previous chart and version when AI times out', async () => {
    const { service, charts, fetchMock, media } = setup();
    const previous = { status: 'CONFIRMED', rows: [{ size: 'M', chest: { min: 84, max: 88 } }] };
    charts.getOwned.mockResolvedValue({ version: 3, sizeChart: previous, sizes: ['M'] });
    fetchMock.mockRejectedValue(new Error('timeout'));
    const result = await service.uploadAndExtract('u', 'p', { ...dto, expectedVersion: 3 }, file);
    expect(result).toMatchObject({
      version: 3,
      sizes: ['M'],
      sizeChart: previous,
      extractionFailed: true,
    });
    expect(charts.saveDraft).not.toHaveBeenCalled();
    expect(media.uploadImage).not.toHaveBeenCalled();
    expect(media.deleteByUrl).not.toHaveBeenCalled();
  });
  it('explains when the local AI service is unreachable', async () => {
    const { service, charts, fetchMock } = setup();
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const result = await service.uploadAndExtract('u', 'p', dto, file);
    expect(result).toMatchObject({ extractionFailed: true, sizeChart: null, version: 0 });
    expect(result.warnings[0]).toContain('khởi động ai-service');
    expect(charts.saveDraft).not.toHaveBeenCalled();
  });
  it('explains exhausted AI quota without making up chart measurements', async () => {
    const { service, charts, fetchMock } = setup();
    fetchMock.mockResolvedValue({ ok: false, status: 429 } as Response);
    const result = await service.uploadAndExtract('u', 'p', dto, file);
    expect(result).toMatchObject({ extractionFailed: true, sizeChart: null, version: 0 });
    expect(result.warnings[0]).toContain('hết hạn mức AI');
    expect(charts.saveDraft).not.toHaveBeenCalled();
  });
  it.each([
    { status: 503, message: 'Gemini tạm quá tải hoặc không khả dụng (503)' },
    { status: 504, message: 'Gemini phản hồi quá thời gian (504)' },
  ])('keeps the previous chart when AI returns $status', async ({ status, message }) => {
    const { service, charts, fetchMock, media } = setup();
    const previous = {
      status: 'CONFIRMED',
      imageUrl: 'https://res.cloudinary.com/example/image/upload/previous.png',
      rows: [{ size: 'M', chest: { min: 84, max: 88 } }],
    };
    charts.getOwned.mockResolvedValue({ version: 3, sizeChart: previous, sizes: ['M'] });
    fetchMock.mockResolvedValue({ ok: false, status } as Response);

    const result = await service.uploadAndExtract('u', 'p', { ...dto, expectedVersion: 3 }, file);

    expect(result).toMatchObject({
      version: 3,
      sizeChart: previous,
      extractionFailed: true,
    });
    expect(result.warnings[0]).toContain(message);
    expect(result.warnings[0]).toContain('Ảnh mới chưa được lưu');
    expect(charts.saveDraft).not.toHaveBeenCalled();
    expect(media.uploadImage).not.toHaveBeenCalled();
    expect(media.deleteByUrl).not.toHaveBeenCalled();
  });
  it('does not report a database failure after OCR as an image reading failure', async () => {
    const { service, charts, media } = setup();
    charts.saveDraft.mockRejectedValue(new BadRequestException('Invalid saved chart'));
    await expect(service.uploadAndExtract('u', 'p', dto, file)).rejects.toThrow(
      BadRequestException,
    );
    expect(charts.saveDraft).toHaveBeenCalledTimes(1);
    expect(media.deleteByUrl).toHaveBeenCalledTimes(1);
  });
  it.each([
    { lengthUnit: null, rows: [{ size: 'M', chest: { min: 86, max: 89 } }] },
    { lengthUnit: 'CM', rows: [{ size: 'M', chest: { min: '86', max: 89 } }] },
    { lengthUnit: 'CM', rows: [{ size: 'M', status: 'CONFIRMED' }] },
  ])('does not trust malformed extraction %j', async (result) => {
    const { service, charts, fetchMock } = setup();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => result,
    } as Response);
    expect(await service.uploadAndExtract('u', 'p', dto, file)).toMatchObject({
      extractionFailed: true,
    });
    expect(charts.saveDraft).not.toHaveBeenCalled();
  });
  it('does not overwrite a newer chart when AI finishes after a provider edit', async () => {
    const { service, charts, media } = setup();
    charts.saveDraft.mockRejectedValue(new ConflictException());
    await expect(service.uploadAndExtract('u', 'p', dto, file)).rejects.toThrow(
      ConflictException,
    );
    expect(charts.saveDraft).toHaveBeenCalledTimes(1);
    expect(media.deleteByUrl).toHaveBeenCalledTimes(1);
  });
  it('cleans up the image if its versioned save loses a race', async () => {
    const { service, charts, media, fetchMock } = setup();
    charts.saveDraft.mockRejectedValue(new ConflictException());
    await expect(service.uploadAndExtract('u', 'p', dto, file)).rejects.toThrow(
      ConflictException,
    );
    expect(media.deleteByUrl).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
