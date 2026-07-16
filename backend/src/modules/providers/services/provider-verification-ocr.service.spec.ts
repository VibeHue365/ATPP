import { HttpException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ProviderVerificationService } from './provider-verification.service';
import {
  OcrStatus,
  ProviderDocumentType,
} from '../schemas/provider-verification.schema';

describe('ProviderVerificationService OCR', () => {
  const verificationId = new Types.ObjectId();
  const ownerName = 'Đặng Văn A';
  let auditLogModel: { countDocuments: jest.Mock };
  let service: ProviderVerificationService;

  beforeEach(() => {
    auditLogModel = { countDocuments: jest.fn() };
    service = new ProviderVerificationService(
      {} as any,
      {} as any,
      {} as any,
      auditLogModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('masks and hashes a 9-digit identity number while matching a Vietnamese owner name', async () => {
    jest.spyOn(service as any, 'runTesseractForVersion').mockResolvedValue({
      text: 'DANG VAN A CCCD 012345678',
      confidence: 0.92,
    });

    const result = await (service as any).extractSafeOcrResult(
      { mimeType: 'image/jpeg' },
      { businessProfile: { ownerName } },
      ProviderDocumentType.IdentityCardFront,
    );

    expect(result.ocrStatus).toBe(OcrStatus.Passed);
    expect(result.mismatchFlags).toEqual([]);
    expect(result.extractedFields).toMatchObject({
      fullName: ownerName,
      idNumberMasked: '*****5678',
    });
    expect((result.extractedFields as Record<string, string>).idNumberHash).toHaveLength(64);
  });

  it('returns low confidence before a profile mismatch warning', async () => {
    jest.spyOn(service as any, 'runTesseractForVersion').mockResolvedValue({
      text: '012345678',
      confidence: 0.65,
    });

    const result = await (service as any).extractSafeOcrResult(
      { mimeType: 'image/jpeg' },
      { businessProfile: { ownerName } },
      ProviderDocumentType.IdentityCardFront,
    );

    expect(result.ocrStatus).toBe(OcrStatus.LowConfidence);
    expect(result.mismatchFlags).toContain('OWNER_NAME_NOT_FOUND_IN_OCR_TEXT');
  });

  it('returns manual review without storing sensitive values for PDFs', async () => {
    const result = await (service as any).extractSafeOcrResult(
      { mimeType: 'application/pdf' },
      { businessProfile: { ownerName } },
      ProviderDocumentType.BusinessLicense,
    );

    expect(result.ocrStatus).toBe(OcrStatus.NeedsManualReview);
    expect(result.extractedFields).toEqual({
      fullName: ownerName,
      idNumberMasked: null,
      idNumberHash: null,
    });
  });

  it('enforces the per-user OCR hourly limit', async () => {
    auditLogModel.countDocuments
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(0);

    await expect(
      (service as any).assertOcrRateLimit(
        { sub: new Types.ObjectId().toString(), roles: ['CUSTOMER'] },
        verificationId,
        ProviderDocumentType.IdentityCardFront,
      ),
    ).rejects.toBeInstanceOf(HttpException);
  });
});