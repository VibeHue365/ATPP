import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrivateStorageService } from '../../storage/services/private-storage.service';
import { PrivateEvidenceUpload } from '../schemas/private-evidence-upload.schema';

const EVIDENCE_BUCKET = 'dispute-evidence-private';

@Injectable()
export class PrivateEvidenceCleanupService {
  private readonly logger = new Logger(PrivateEvidenceCleanupService.name);

  constructor(
    @InjectModel(PrivateEvidenceUpload.name)
    private readonly uploadModel: Model<PrivateEvidenceUpload>,
    private readonly privateStorage: PrivateStorageService,
  ) {}

  @Cron('15 * * * *')
  async removeExpiredUnattachedUploads(): Promise<void> {
    const expired = await this.uploadModel
      .find({ incidentId: null, expiresAt: { $lte: new Date() } })
      .limit(200)
      .lean();

    for (const upload of expired) {
      const key = this.storageKey(upload.reference);
      try {
        await this.privateStorage.deletePrivateFile(EVIDENCE_BUCKET, key);
        await this.uploadModel.deleteOne({ _id: upload._id, incidentId: null });
      } catch (error) {
        this.logger.warn(`Unable to remove expired private evidence ${upload._id}: ${String(error)}`);
      }
    }
  }

  private storageKey(reference: string): string {
    return reference.replace('private://dispute-evidence-private/', '');
  }
}