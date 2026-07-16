import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';
import {
  OcrAssessment,
  OcrExecutionStatus,
  OcrStatus,
  ProviderVerification,
} from '../schemas/provider-verification.schema';
import {
  OcrAttemptOutcome,
  ProviderVerificationOcrAttempt,
} from '../schemas/provider-verification-ocr-attempt.schema';

@Injectable()
export class ProviderOcrRecoveryService {
  private readonly logger = new Logger(ProviderOcrRecoveryService.name);

  constructor(
    @InjectModel(ProviderVerification.name)
    private readonly verificationModel: Model<ProviderVerification>,
    @InjectModel(ProviderVerificationOcrAttempt.name)
    private readonly attempts: Model<ProviderVerificationOcrAttempt>,
    private readonly config: ConfigService,
  ) {}

  @Cron('*/30 * * * * *')
  async recoverStuckJobs(): Promise<void> {
    if (this.config.get<string>('OCR_V2_ENABLED', 'false') !== 'true') return;
    const timeoutMs = Number(this.config.get<string>('OCR_STUCK_TIMEOUT_MS', '60000'));
    const cutoff = new Date(Date.now() - Math.max(timeoutMs, 1000));
    const candidates = await this.verificationModel
      .find({ 'documents.versions.ocr.executionStatus': OcrExecutionStatus.Processing })
      .select({ documents: 1 })
      .limit(100);

    for (const verification of candidates) {
      for (const document of verification.documents) {
        for (const version of document.versions) {
          if (!version.isCurrent || version.ocr?.executionStatus !== OcrExecutionStatus.Processing) continue;
          const heartbeatAt = version.ocr.heartbeatAt ?? version.ocr.startedAt;
          if (!heartbeatAt || heartbeatAt > cutoff) continue;
          const result = await this.verificationModel.updateOne(
            { _id: verification._id },
            {
              $set: {
                'documents.$[d].versions.$[v].ocr.executionStatus': OcrExecutionStatus.Timeout,
                'documents.$[d].versions.$[v].ocr.assessment': OcrAssessment.ReuploadRequired,
                'documents.$[d].versions.$[v].ocr.completedAt': new Date(),
                'documents.$[d].versions.$[v].ocr.warningCodes': ['OCR_HEARTBEAT_TIMEOUT'],
                'documents.$[d].versions.$[v].ocrStatus': OcrStatus.Failed,
                'documents.$[d].versions.$[v].mismatchFlags': ['OCR_HEARTBEAT_TIMEOUT'],
              },
              $inc: { verificationRevision: 1 },
            },
            {
              arrayFilters: [
                { 'd.documentType': document.documentType },
                {
                  'v.versionNo': version.versionNo,
                  'v.isCurrent': true,
                  'v.ocr.executionStatus': OcrExecutionStatus.Processing,
                  'v.ocr.activeAttemptId': version.ocr.activeAttemptId,
                  'v.ocr.heartbeatAt': { $lte: cutoff },
                },
              ],
            },
          );
          if (!result.modifiedCount) continue;

          this.logger.warn(`Timed out stale OCR attempt for ${verification._id}:${document.documentType}:v${version.versionNo}`);
          if (version.ocr?.activeAttemptId) {
            await this.attempts.updateOne(
              { attemptId: version.ocr.activeAttemptId, outcome: null },
              {
                $set: {
                  outcome: OcrAttemptOutcome.TimedOut,
                  retryable: false,
                  errorCode: 'OCR_HEARTBEAT_TIMEOUT',
                  completedAt: new Date(),
                },
              },
            );
          }
        }
      }
    }
  }
}