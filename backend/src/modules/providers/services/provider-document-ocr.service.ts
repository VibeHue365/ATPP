import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHmac } from 'crypto';
import sharp from 'sharp';
import { Model, Types } from 'mongoose';
import { PrivateStorageService } from '../../storage/services/private-storage.service';
import { OcrAssessment, OcrExecutionStatus, OcrStatus, ProviderVerification } from '../schemas/provider-verification.schema';
import { OcrAttemptOutcome, ProviderVerificationOcrAttempt } from '../schemas/provider-verification-ocr-attempt.schema';
import { ProviderOcrJobData } from './provider-ocr-queue.service';

@Injectable()
export class ProviderDocumentOcrService {
  constructor(@InjectModel(ProviderVerification.name) private readonly verificationModel: Model<ProviderVerification>, @InjectModel(ProviderVerificationOcrAttempt.name) private readonly attempts: Model<ProviderVerificationOcrAttempt>, private readonly storage: PrivateStorageService, private readonly config: ConfigService) {}
  async process(job: ProviderOcrJobData, retryRemaining = false): Promise<void> {
    if (!Types.ObjectId.isValid(job.verificationId)) {
      throw new Error('Invalid provider verification identifier in OCR job');
    }
    const verificationId = new Types.ObjectId(job.verificationId);
    const startedAt = new Date();
    await this.attempts.updateOne({ attemptId: job.attemptId }, { $setOnInsert: { verificationId, documentType: job.documentType, versionNo: job.versionNo, attemptId: job.attemptId, operationId: job.operationId, startedAt, heartbeatAt: startedAt, retryable: false, engine: 'TESSERACT', language: this.config.get<string>('TESSERACT_LANG', 'vie+eng'), psmMode: 6 } }, { upsert: true });
    const verification = await this.verificationModel.findById(verificationId);
    const document = verification?.documents.find((item) => item.documentType === job.documentType);
    const version = document?.versions.find((item) => item.versionNo === job.versionNo && item.isCurrent);
    if (!verification || !version || version.ocr?.activeAttemptId !== job.attemptId || version.ocr.executionStatus !== OcrExecutionStatus.Processing) return this.record(job, OcrAttemptOutcome.StaleDiscarded, false);
    const heartbeat = setInterval(() => {
      const now = new Date();
      void this.attempts.updateOne({ attemptId: job.attemptId, outcome: null }, { $set: { heartbeatAt: now } });
      void this.verificationModel.updateOne({ _id: verificationId }, { $set: { 'documents.$[d].versions.$[v].ocr.heartbeatAt': now } }, { arrayFilters: [{ 'd.documentType': job.documentType }, { 'v.versionNo': job.versionNo, 'v.isCurrent': true, 'v.ocr.activeAttemptId': job.attemptId, 'v.ocr.executionStatus': OcrExecutionStatus.Processing }] });
    }, 10000);
    try {
      if (version.mimeType === 'application/pdf') return await this.finish(job, OcrExecutionStatus.Skipped, OcrAssessment.ManualReview, OcrStatus.NeedsManualReview, 0, {}, ['PDF_OCR_REQUIRES_MANUAL_REVIEW']);
      const stream = await this.storage.readPrivateFile(version.bucket, version.storageKey); const chunks: Buffer[] = []; for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const image = sharp(Buffer.concat(chunks), { failOn: 'none' }).rotate();
      const stats = await image.stats();
      const luminance = (stats.channels[0]?.mean ?? 128) / 255;
      const contrast = stats.channels[0]?.stdev ?? 64;
      const qualityWarnings: string[] = [];
      if (luminance < 0.2) qualityWarnings.push('IMAGE_TOO_DARK');
      if (luminance > 0.9) qualityWarnings.push('IMAGE_TOO_BRIGHT');
      if (contrast < 18) qualityWarnings.push('IMAGE_LOW_CONTRAST');
      const result = await this.remoteOcr(await image.grayscale().normalise().sharpen().png().toBuffer());
      const isIdentityFront = job.documentType === 'IDENTITY_CARD_FRONT';
      const detectedIdNumber = result.text.match(/\b\d{9,12}\b/)?.[0] ?? null;
      const ownerName = isIdentityFront
        ? verification.businessProfile.ownerName?.trim() ?? null
        : null;
      const normalizedText = this.normalize(result.text);
      const warnings: string[] = [...qualityWarnings];

      // A CCCD back image, shop photo, or portfolio does not necessarily contain
      // the provider name or identity number. Requiring those fields made valid
      // OCR attempts appear as OCR_FAILED and incorrectly requested a re-upload.
      if (!result.text) warnings.push('OCR_TEXT_EMPTY');
      if (isIdentityFront && !detectedIdNumber) warnings.push('OCR_ID_NUMBER_NOT_FOUND');
      if (ownerName && !normalizedText.includes(this.normalize(ownerName))) {
        warnings.push('OWNER_NAME_MISMATCH');
      }
      if (result.confidence < 0.8) warnings.push('OCR_LOW_CONFIDENCE');
      const peer = verification.documents.find((item) => item.documentType !== job.documentType && (item.documentType === 'IDENTITY_CARD_FRONT' || item.documentType === 'IDENTITY_CARD_BACK'))?.versions.find((candidate) => candidate.isCurrent);
      const currentFingerprint = detectedIdNumber ? this.fingerprint(detectedIdNumber) : null;
      if (currentFingerprint && peer?.ocr?.identityFingerprint && peer.ocr.identityFingerprint.keyId === this.config.get<string>('IDENTITY_FINGERPRINT_KEY_ID', 'v1') && peer.ocr.identityFingerprint.value !== currentFingerprint) warnings.push('IDENTITY_NUMBER_MISMATCH_BETWEEN_SIDES');
      const hasRequiredEvidence = Boolean(result.text) && (!isIdentityFront || Boolean(detectedIdNumber));
      const assessment = !hasRequiredEvidence || qualityWarnings.length > 0 ? OcrAssessment.ReuploadRequired : result.confidence < 0.8 ? OcrAssessment.LowConfidence : warnings.includes('OWNER_NAME_MISMATCH') || warnings.includes('IDENTITY_NUMBER_MISMATCH_BETWEEN_SIDES') ? OcrAssessment.Mismatch : OcrAssessment.Passed;
      const legacy = assessment === OcrAssessment.Passed ? OcrStatus.Passed : assessment === OcrAssessment.LowConfidence ? OcrStatus.LowConfidence : assessment === OcrAssessment.Mismatch ? OcrStatus.MismatchDetected : OcrStatus.Failed;
      const fields = { fullName: { value: ownerName && normalizedText.includes(this.normalize(ownerName)) ? ownerName : null, confidence: result.confidence }, idNumberMasked: { value: detectedIdNumber ? `${'*'.repeat(Math.max(0, detectedIdNumber.length - 4))}${detectedIdNumber.slice(-4)}` : null, confidence: result.confidence } };
      await this.finish(job, OcrExecutionStatus.Succeeded, assessment, legacy, result.confidence, fields, warnings, detectedIdNumber ?? undefined);
    } catch (error) {
      if (retryRemaining) {
        await this.attempts.updateOne({ attemptId: job.attemptId }, { $set: { retryable: true, errorCode: 'OCR_ENGINE_UNAVAILABLE', heartbeatAt: new Date() } });
      } else {
        await this.finish(job, OcrExecutionStatus.Failed, OcrAssessment.ReuploadRequired, OcrStatus.Failed, 0, {}, ['OCR_ENGINE_UNAVAILABLE']);
      }
      throw error;
    } finally { clearInterval(heartbeat); }
  }
  private async remoteOcr(buffer: Buffer): Promise<{ text: string; confidence: number }> { const url = this.config.get<string>('OCR_SERVICE_URL'); if (!url) throw new Error('OCR_SERVICE_URL is required for OCR V2 worker'); const form = new FormData(); form.append('file', new Blob([Uint8Array.from(buffer)], { type: 'image/png' }), 'document.png'); const response = await fetch(`${url.replace(/\/$/, '')}/ocr`, { method: 'POST', body: form, signal: AbortSignal.timeout(Number(this.config.get<string>('OCR_TIMEOUT_MS', '30000'))) }); if (!response.ok) throw new Error('OCR engine unavailable'); const data = await response.json() as { text?: string; confidence?: number }; return { text: typeof data.text === 'string' ? data.text : '', confidence: typeof data.confidence === 'number' ? data.confidence : 0 }; }
  private async finish(job: ProviderOcrJobData, execution: OcrExecutionStatus, assessment: OcrAssessment | null, legacy: OcrStatus, confidence: number, fields: Record<string, unknown>, warnings: string[], idNumber?: string): Promise<void> { const update: Record<string, unknown> = { 'documents.$[d].versions.$[v].ocr.executionStatus': execution, 'documents.$[d].versions.$[v].ocr.assessment': assessment, 'documents.$[d].versions.$[v].ocr.completedAt': new Date(), 'documents.$[d].versions.$[v].ocr.warningCodes': warnings, 'documents.$[d].versions.$[v].ocr.qualityIssues': warnings.filter((warning) => warning.startsWith('IMAGE_')), 'documents.$[d].versions.$[v].ocr.crossCheckComputedAt': new Date(), 'documents.$[d].versions.$[v].ocrStatus': legacy, 'documents.$[d].versions.$[v].ocrConfidence': confidence, 'documents.$[d].versions.$[v].extractedFields': fields, 'documents.$[d].versions.$[v].mismatchFlags': warnings, 'documents.$[d].versions.$[v].processedAt': new Date() }; if (idNumber) { update['documents.$[d].versions.$[v].ocr.identityFingerprint'] = { keyId: this.config.get<string>('IDENTITY_FINGERPRINT_KEY_ID', 'v1'), value: this.fingerprint(idNumber) }; }
    const result = await this.verificationModel.updateOne({ _id: new Types.ObjectId(job.verificationId) }, { $set: update, $inc: { verificationRevision: 1 } }, { arrayFilters: [{ 'd.documentType': job.documentType }, { 'v.versionNo': job.versionNo, 'v.isCurrent': true, 'v.ocr.activeAttemptId': job.attemptId, 'v.ocr.executionStatus': OcrExecutionStatus.Processing }] });
    await this.record(job, result.matchedCount ? execution === OcrExecutionStatus.Failed ? OcrAttemptOutcome.FailedTerminal : OcrAttemptOutcome.Succeeded : OcrAttemptOutcome.StaleDiscarded, false);
  }
  private async record(job: ProviderOcrJobData, outcome: OcrAttemptOutcome, retryable: boolean): Promise<void> { await this.attempts.updateOne({ attemptId: job.attemptId }, { $set: { outcome, retryable, completedAt: new Date() } }); }
  private fingerprint(value: string): string { const secret = this.config.get<string>('IDENTITY_FINGERPRINT_SECRET'); if (!secret) throw new Error('IDENTITY_FINGERPRINT_SECRET is required'); return createHmac('sha256', secret).update(value).digest('hex'); }
  private normalize(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]/g, ''); }
}