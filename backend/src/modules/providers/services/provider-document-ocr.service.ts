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
    await this.attempts.updateOne(
      { attemptId: job.attemptId },
      {
        $setOnInsert: {
          verificationId,
          documentType: job.documentType,
          versionNo: job.versionNo,
          attemptId: job.attemptId,
          operationId: job.operationId,
          startedAt,
          heartbeatAt: startedAt,
          retryable: false,
          engine: 'TESSERACT',
          language: this.config.get<string>('TESSERACT_LANG', 'vie+eng'),
          psmMode: 6,
        },
      },
      { upsert: true },
    );

    const verification = await this.verificationModel.findById(verificationId);
    const document = verification?.documents.find((item) => item.documentType === job.documentType);
    const version = document?.versions.find((item) => item.versionNo === job.versionNo && item.isCurrent);
    if (
      !verification ||
      !version ||
      version.ocr?.activeAttemptId !== job.attemptId ||
      version.ocr.executionStatus !== OcrExecutionStatus.Processing
    ) {
      return this.record(job, OcrAttemptOutcome.StaleDiscarded, false);
    }

    const heartbeat = setInterval(() => {
      const now = new Date();
      void this.attempts.updateOne({ attemptId: job.attemptId, outcome: null }, { $set: { heartbeatAt: now } });
      void this.verificationModel.updateOne(
        { _id: verificationId },
        { $set: { 'documents.$[d].versions.$[v].ocr.heartbeatAt': now } },
        {
          arrayFilters: [
            { 'd.documentType': job.documentType },
            {
              'v.versionNo': job.versionNo,
              'v.isCurrent': true,
              'v.ocr.activeAttemptId': job.attemptId,
              'v.ocr.executionStatus': OcrExecutionStatus.Processing,
            },
          ],
        },
      );
    }, 10000);

    try {
      if (version.mimeType === 'application/pdf') {
        return await this.finish(
          job,
          OcrExecutionStatus.Skipped,
          OcrAssessment.ManualReview,
          OcrStatus.NeedsManualReview,
          0,
          {},
          ['PDF_OCR_REQUIRES_MANUAL_REVIEW'],
        );
      }

      const stream = await this.storage.readPrivateFile(version.bucket, version.storageKey);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const rawBuffer = Buffer.concat(chunks);

      const image = sharp(rawBuffer, { failOn: 'none' }).rotate();
      const stats = await image.stats();
      const luminance = (stats.channels[0]?.mean ?? 128) / 255;
      const contrast = stats.channels[0]?.stdev ?? 64;
      const blur = await this.blurScore(rawBuffer);

      const minLuminance = Number(this.config.get<string>('OCR_MIN_LUMINANCE', '0.2'));
      const maxLuminance = Number(this.config.get<string>('OCR_MAX_LUMINANCE', '0.98'));
      const minContrast = Number(this.config.get<string>('OCR_MIN_CONTRAST', '18'));
      const blurThreshold = Number(this.config.get<string>('OCR_BLUR_THRESHOLD', '15'));

      const qualityWarnings: string[] = [];
      if (luminance < minLuminance) qualityWarnings.push('IMAGE_TOO_DARK');
      if (luminance > maxLuminance) qualityWarnings.push('IMAGE_TOO_BRIGHT');
      if (contrast < minContrast) qualityWarnings.push('IMAGE_LOW_CONTRAST');
      if (blur < blurThreshold) qualityWarnings.push('IMAGE_BLURRY');

      // Preprocess & resize to standard width before OCR
      const preprocessed = await image
        .resize({ width: 1800, withoutEnlargement: true })
        .grayscale()
        .normalise()
        .sharpen()
        .png()
        .toBuffer();

      const result = await this.remoteOcr(preprocessed);

      const isIdentityFront = job.documentType === 'IDENTITY_CARD_FRONT';
      const isIdentityBack = job.documentType === 'IDENTITY_CARD_BACK';
      const isPassport = job.documentType === 'PASSPORT';

      // Lookaround regex to avoid false matches with 10-11 digit phone numbers or timestamps
      const match12 = result.text.match(/(?<!\d)\d{12}(?!\d)/);
      const match9 = result.text.match(/(?<!\d)\d{9}(?!\d)/);
      const matchPassport = result.text.match(/(?<![A-Z0-9])[A-Z]\d{7}(?![A-Z0-9])/i);

      let detectedIdNumber: string | null = null;
      if (isPassport) {
        detectedIdNumber = matchPassport?.[0] ?? null;
      } else if (isIdentityFront) {
        detectedIdNumber = match12?.[0] ?? match9?.[0] ?? null;
      }

      const warnings: string[] = [...qualityWarnings];

      if (!result.text || result.text.trim().length === 0) {
        warnings.push('OCR_TEXT_EMPTY');
      }

      if (isIdentityFront && !detectedIdNumber) {
        warnings.push('OCR_ID_NUMBER_NOT_FOUND');
      }

      // Structure check for 12-digit CCCD
      if (detectedIdNumber && detectedIdNumber.length === 12) {
        const provinceCode = parseInt(detectedIdNumber.slice(0, 3), 10);
        const genderCentury = parseInt(detectedIdNumber.charAt(3), 10);
        if (provinceCode < 1 || provinceCode > 96 || isNaN(genderCentury)) {
          warnings.push('ID_NUMBER_INCONSISTENT');
        }
      }

      // Owner name fuzzy match using Levenshtein distance across lines
      const ownerName = (isIdentityFront || isPassport)
        ? verification.businessProfile.ownerName?.trim() ?? null
        : null;

      const linesText = result.lines && result.lines.length > 0
        ? result.lines.map((l) => l.text)
        : result.text.split('\n');

      let nameSim = 1.0;
      if (ownerName) {
        nameSim = this.nameSimilarity(ownerName, linesText);
        if (nameSim < 0.60) {
          warnings.push('OWNER_NAME_MISMATCH');
        } else if (nameSim < 0.80) {
          warnings.push('OWNER_NAME_UNCERTAIN');
        }
      }

      const confThreshold = Number(this.config.get<string>('OCR_CONFIDENCE_THRESHOLD', '0.65'));
      if (result.confidence < confThreshold) {
        warnings.push('OCR_LOW_CONFIDENCE');
      }

      // Three-tier decision model
      const isCriticalDarkOrBlur = luminance < minLuminance || blur < blurThreshold;
      const hasHeavyIssue = isCriticalDarkOrBlur || warnings.includes('OCR_TEXT_EMPTY');
      const hasSoftIssue =
        warnings.includes('OWNER_NAME_MISMATCH') ||
        warnings.includes('OWNER_NAME_UNCERTAIN') ||
        warnings.includes('OCR_ID_NUMBER_NOT_FOUND') ||
        warnings.includes('ID_NUMBER_INCONSISTENT') ||
        warnings.includes('IMAGE_TOO_BRIGHT') ||
        warnings.includes('IMAGE_LOW_CONTRAST') ||
        result.confidence < confThreshold;

      let assessment: OcrAssessment;
      if (hasHeavyIssue) {
        assessment = OcrAssessment.ReuploadRequired;
      } else if (hasSoftIssue) {
        assessment = OcrAssessment.ManualReview;
      } else {
        assessment = OcrAssessment.Passed;
      }

      const legacy = assessment === OcrAssessment.Passed
        ? OcrStatus.Passed
        : assessment === OcrAssessment.ReuploadRequired
          ? OcrStatus.Failed
          : OcrStatus.NeedsManualReview;

      const detectedFullName = (isIdentityFront || isPassport) ? this.extractFullName(linesText) : null;
      const detectedDob = (isIdentityFront || isPassport) ? this.extractDob(result.text) : null;
      const detectedAddress = isIdentityFront ? this.extractAddress(linesText) : null;

      const finalName = detectedFullName || (ownerName && nameSim >= 0.60 ? ownerName : null);

      const fields: Record<string, unknown> = {
        fullName: {
          value: finalName,
          confidence: result.confidence,
          similarity: Math.round(nameSim * 100) / 100,
        },
        idNumberMasked: {
          value: detectedIdNumber
            ? `${'*'.repeat(Math.max(0, detectedIdNumber.length - 4))}${detectedIdNumber.slice(-4)}`
            : null,
          confidence: result.confidence,
        },
      };

      if (detectedDob) {
        fields.dateOfBirth = { value: detectedDob, confidence: result.confidence };
      }
      if (detectedAddress) {
        fields.address = { value: detectedAddress, confidence: result.confidence };
      }

      // Only store identity fingerprint for front side to prevent false mismatches
      const fingerprintValue = (isIdentityFront && detectedIdNumber) ? detectedIdNumber : undefined;
      await this.finish(job, OcrExecutionStatus.Succeeded, assessment, legacy, result.confidence, fields, warnings, fingerprintValue);
    } catch (error) {
      if (retryRemaining) {
        await this.attempts.updateOne({ attemptId: job.attemptId }, { $set: { retryable: true, errorCode: 'OCR_ENGINE_UNAVAILABLE', heartbeatAt: new Date() } });
      } else {
        await this.finish(job, OcrExecutionStatus.Failed, OcrAssessment.ReuploadRequired, OcrStatus.Failed, 0, {}, ['OCR_ENGINE_UNAVAILABLE']);
      }
      throw error;
    } finally {
      clearInterval(heartbeat);
    }
  }

  private async blurScore(buffer: Buffer): Promise<number> {
    try {
      const { channels } = await sharp(buffer)
        .resize({ width: 800, withoutEnlargement: true })
        .grayscale()
        .convolve({
          width: 3,
          height: 3,
          kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0],
          scale: 1,
          offset: 128,
        })
        .stats();
      return (channels[0]?.stdev ?? 0) ** 2;
    } catch {
      return 100;
    }
  }

  private levenshteinDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = [];
    for (let i = 0; i <= m; i++) dp[i] = [i];
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost,
        );
      }
    }
    return dp[m][n];
  }

  private nameSimilarity(ownerName: string, lines: string[]): number {
    const target = this.normalize(ownerName);
    if (!target) return 1.0;
    let best = 0;

    for (const line of lines) {
      const l = this.normalize(line);
      if (!l) continue;
      if (l.includes(target) || target.includes(l)) return 1.0;

      const sliceLen = Math.min(l.length, target.length + 4);
      const lSlice = l.slice(0, sliceLen);
      const dist = this.levenshteinDistance(target, lSlice);
      const sim = 1 - dist / Math.max(target.length, 1);
      if (sim > best) best = sim;

      const words = l.split(/\s+/).filter(Boolean);
      for (let i = 0; i < words.length; i++) {
        for (let j = i + 1; j <= words.length; j++) {
          const phrase = words.slice(i, j).join('');
          if (phrase.length >= Math.max(3, target.length - 3)) {
            const pDist = this.levenshteinDistance(target, phrase);
            const pSim = 1 - pDist / Math.max(target.length, 1);
            if (pSim > best) best = pSim;
          }
        }
      }
    }
    return Math.max(0, Math.min(1, best));
  }

  private extractFullName(lines: string[]): string | null {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (/h[oọ]\s*v[aà]\s*t[eêéèẽẻẹ]|full\s*name|h[oọ]\s*t[eêéèẽẻẹ]/i.test(line)) {
        const parts = line.split(/[:\/\-]/);
        const after = parts[parts.length - 1].trim();
        const afterWords = after.split(/\s+/).filter((w) => /^[A-Z\u00C0-\u1EF9]{2,}$/u.test(w));
        if (afterWords.length >= 2) {
          return afterWords.join(' ');
        }
        for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
          const aheadLine = lines[j].trim();
          if (/ngay\s*sinh|date\s*of\s*birth|sinh\s*ngay/i.test(aheadLine)) break;
          const words = aheadLine.split(/\s+/);
          const nameWords = words.filter((w) => /^[A-Z\u00C0-\u1EF9]{2,}$/u.test(w));
          if (nameWords.length >= 2) {
            return nameWords.join(' ');
          }
        }
      }
    }
    return null;
  }

  private extractDob(text: string): string | null {
    const dobMatch =
      text.match(/(?:ngay sinh|date of birth|sinh ngay)[:\s]*(\d{2}[\/\.-]\d{2}[\/\.-]\d{4})/i) ||
      text.match(/(\d{2}\/\d{2}\/\d{4})/);
    return dobMatch ? dobMatch[1] : null;
  }

  private extractAddress(lines: string[]): string | null {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (/noi\s*thuong\s*tru|noi\s*cu\s*tru|thuong\s*tru|place\s*of\s*residence/i.test(line)) {
        const afterLabel = line
          .replace(/.*(?:place\s*of\s*residence|noi\s*thuong\s*tru|thuong\s*tru|noi\s*cu\s*tru)[:\s\/]*/i, '')
          .trim();
        const addrParts: string[] = [];
        if (afterLabel.length >= 5) {
          addrParts.push(afterLabel);
        }
        for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
          let nextLine = lines[j].trim();
          if (/co\s*gia\s*tri|date\s*of\s*expiry|ngay\s*het\s*han/i.test(nextLine)) {
            nextLine = nextLine
              .replace(/.*(?:date\s*of\s*expiry|co\s*gia\s*tri\s*den)[:\s\d\/\.-]*/i, '')
              .trim();
          }
          if (/^\d{2}[\/\.-]\d{2}[\/\.-]\d{4}$/.test(nextLine)) break;
          if (nextLine.length >= 3) {
            addrParts.push(nextLine);
          }
        }
        if (addrParts.length > 0) {
          return addrParts.join(' ').replace(/\s+,/g, ',').trim();
        }
      }
    }
    return null;
  }

  private async remoteOcr(buffer: Buffer): Promise<{
    text: string;
    confidence: number;
    lines?: Array<{ text: string; confidence: number; bbox?: number[] }>;
  }> {
    const url = this.config.get<string>('OCR_SERVICE_URL');
    if (!url) throw new Error('OCR_SERVICE_URL is required for OCR V2 worker');
    const form = new FormData();
    form.append('file', new Blob([Uint8Array.from(buffer)], { type: 'image/png' }), 'document.png');
    const response = await fetch(`${url.replace(/\/$/, '')}/ocr`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(Number(this.config.get<string>('OCR_TIMEOUT_MS', '30000'))),
    });
    if (!response.ok) throw new Error('OCR engine unavailable');
    const data = (await response.json()) as {
      text?: string;
      confidence?: number;
      lines?: Array<{ text: string; confidence: number; bbox?: number[] }>;
    };
    return {
      text: typeof data.text === 'string' ? data.text : '',
      confidence: typeof data.confidence === 'number' ? data.confidence : 0,
      lines: Array.isArray(data.lines) ? data.lines : [],
    };
  }

  private async finish(
    job: ProviderOcrJobData,
    execution: OcrExecutionStatus,
    assessment: OcrAssessment | null,
    legacy: OcrStatus,
    confidence: number,
    fields: Record<string, unknown>,
    warnings: string[],
    idNumber?: string,
  ): Promise<void> {
    const update: Record<string, unknown> = {
      'documents.$[d].versions.$[v].ocr.executionStatus': execution,
      'documents.$[d].versions.$[v].ocr.assessment': assessment,
      'documents.$[d].versions.$[v].ocr.completedAt': new Date(),
      'documents.$[d].versions.$[v].ocr.warningCodes': warnings,
      'documents.$[d].versions.$[v].ocr.qualityIssues': warnings.filter((warning) => warning.startsWith('IMAGE_')),
      'documents.$[d].versions.$[v].ocr.crossCheckComputedAt': new Date(),
      'documents.$[d].versions.$[v].ocrStatus': legacy,
      'documents.$[d].versions.$[v].ocrConfidence': confidence,
      'documents.$[d].versions.$[v].extractedFields': fields,
      'documents.$[d].versions.$[v].mismatchFlags': warnings,
      'documents.$[d].versions.$[v].processedAt': new Date(),
    };
    if (idNumber) {
      update['documents.$[d].versions.$[v].ocr.identityFingerprint'] = {
        keyId: this.config.get<string>('IDENTITY_FINGERPRINT_KEY_ID', 'v1'),
        value: this.fingerprint(idNumber),
      };
    }
    const result = await this.verificationModel.updateOne(
      { _id: new Types.ObjectId(job.verificationId) },
      { $set: update, $inc: { verificationRevision: 1 } },
      {
        arrayFilters: [
          { 'd.documentType': job.documentType },
          {
            'v.versionNo': job.versionNo,
            'v.isCurrent': true,
            'v.ocr.activeAttemptId': job.attemptId,
            'v.ocr.executionStatus': OcrExecutionStatus.Processing,
          },
        ],
      },
    );
    await this.record(
      job,
      result.matchedCount
        ? execution === OcrExecutionStatus.Failed
          ? OcrAttemptOutcome.FailedTerminal
          : OcrAttemptOutcome.Succeeded
        : OcrAttemptOutcome.StaleDiscarded,
      false,
    );
  }

  private async record(job: ProviderOcrJobData, outcome: OcrAttemptOutcome, retryable: boolean): Promise<void> {
    await this.attempts.updateOne({ attemptId: job.attemptId }, { $set: { outcome, retryable, completedAt: new Date() } });
  }

  private fingerprint(value: string): string {
    const secret = this.config.get<string>('IDENTITY_FINGERPRINT_SECRET');
    if (!secret) throw new Error('IDENTITY_FINGERPRINT_SECRET is required');
    return createHmac('sha256', secret).update(value).digest('hex');
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]/g, '');
  }
}