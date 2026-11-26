import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrivateStorageService } from '../../storage/services/private-storage.service';
import { RentalEvidenceUpload } from '../schemas/rental-evidence-upload.schema';
import { RENTAL_EVIDENCE_RETENTION_MS } from './rental-evidence-policy';

@Injectable()
export class RentalEvidenceCleanupService {
  private readonly logger = new Logger(RentalEvidenceCleanupService.name);

  constructor(
    @InjectModel(RentalEvidenceUpload.name)
    private readonly uploadModel: Model<RentalEvidenceUpload>,
    private readonly privateStorage: PrivateStorageService,
  ) {}

  @Cron('0 */10 * * * *')
  async removeExpiredEvidence(now = new Date()): Promise<number> {
    const retentionCutoff = new Date(
      now.getTime() - RENTAL_EVIDENCE_RETENTION_MS,
    );
    const expiredFilter = {
      $or: [
        { expiresAt: { $lte: now } },
        { consumedAt: { $ne: null, $lte: retentionCutoff } },
      ],
    };
    const expired = await this.uploadModel
      .find(expiredFilter)
      .limit(200)
      .lean()
      .exec();
    let removed = 0;
    const bookingModel = this.uploadModel.db.model('Booking');
    for (const upload of expired as any[]) {
      if (upload.consumedAt) {
        const disputed = await bookingModel.exists({ _id: upload.bookingId, status: 'DISPUTED' });
        if (disputed) continue;
      }
      try {
        await this.privateStorage.deletePrivateFile(upload.bucket, upload.storageKey);
        const result = await this.uploadModel
          .deleteOne({ _id: upload._id, ...expiredFilter })
          .exec();
        if (result.deletedCount) removed += 1;
      } catch (error) {
        this.logger.warn(`Không thể dọn ảnh bàn giao ${upload.fileId}: ${String(error)}`);
      }
    }
    return removed;
  }
}
