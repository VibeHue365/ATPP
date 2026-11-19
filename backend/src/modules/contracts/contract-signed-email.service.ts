import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { MailService } from '../auth/services/mail.service';
import { ContractEvidenceService } from './contract-evidence.service';
import { contractObjectId } from './contract-source.types';
import {
  ContractConsent,
  ContractConsentAction,
  ContractEmailDeliveryStatus,
} from './schemas/contract-consent.schema';

export interface ContractEmailDeliveryResult {
  status: 'SENT' | 'FAILED' | 'IN_PROGRESS';
  recipient: string;
  sentAt: Date | null;
}

@Injectable()
export class ContractSignedEmailService {
  private readonly logger = new Logger(ContractSignedEmailService.name);

  constructor(
    @InjectModel(ContractConsent.name)
    private readonly consents: Model<ContractConsent>,
    private readonly evidence: ContractEvidenceService,
    private readonly mail: MailService,
  ) {}

  async sendAfterAcceptance(
    user: AuthUser,
    contractId: string,
    versionId: string,
  ): Promise<ContractEmailDeliveryResult> {
    const recipient = user.email?.trim().toLowerCase();
    if (!recipient) {
      return { status: 'FAILED', recipient: '', sentAt: null };
    }

    const consent = await this.consents.findOne({
      contractId: contractObjectId(contractId),
      contractVersionId: contractObjectId(versionId),
      actorUserId: contractObjectId(user.sub),
      action: ContractConsentAction.Accept,
    });
    if (!consent) {
      return { status: 'FAILED', recipient, sentAt: null };
    }
    if (consent.emailDelivery?.status === ContractEmailDeliveryStatus.Sent) {
      return {
        status: 'SENT',
        recipient: consent.emailDelivery.recipient || recipient,
        sentAt: consent.emailDelivery.sentAt || null,
      };
    }

    const now = new Date();
    const claimToken = randomUUID();
    const claimed = await this.consents.findOneAndUpdate(
      {
        _id: consent._id,
        action: ContractConsentAction.Accept,
        $or: [
          { 'emailDelivery.status': { $exists: false } },
          {
            'emailDelivery.status': {
              $in: [
                ContractEmailDeliveryStatus.Pending,
                ContractEmailDeliveryStatus.Failed,
              ],
            },
          },
          {
            'emailDelivery.status': ContractEmailDeliveryStatus.Sending,
            'emailDelivery.leaseExpiresAt': { $lt: now },
          },
        ],
      },
      {
        $set: {
          'emailDelivery.status': ContractEmailDeliveryStatus.Sending,
          'emailDelivery.recipient': recipient,
          'emailDelivery.lastAttemptAt': now,
          'emailDelivery.lastError': null,
          'emailDelivery.claimToken': claimToken,
          'emailDelivery.leaseExpiresAt': new Date(now.getTime() + 60_000),
        },
      },
      { returnDocument: 'after' },
    );

    if (!claimed) {
      const current = await this.consents.findById(consent._id).lean();
      if (current?.emailDelivery?.status === ContractEmailDeliveryStatus.Sent) {
        return {
          status: 'SENT',
          recipient: current.emailDelivery.recipient || recipient,
          sentAt: current.emailDelivery.sentAt || null,
        };
      }
      return { status: 'IN_PROGRESS', recipient, sentAt: null };
    }

    try {
      const { stream, filename, sha256 } = await this.evidence.getPdfStream(
        user,
        contractId,
        versionId,
      );
      const pdf = await this.readBuffer(stream);
      const delivered = await this.mail.sendMail(
        recipient,
        `[TàGo] Hợp đồng điện tử đã ký - ${filename.replace(/\.pdf$/i, '')}`,
        this.html(filename, sha256),
        `Hợp đồng điện tử đã ký của bạn được đính kèm trong email này. Mã SHA-256: ${sha256}`,
        [{ filename, content: pdf, contentType: 'application/pdf' }],
      );
      if (!delivered) throw new Error('MAIL_NOT_CONFIGURED');

      const sentAt = new Date();
      await this.consents.updateOne(
        { _id: consent._id, 'emailDelivery.claimToken': claimToken },
        {
          $set: {
            'emailDelivery.status': ContractEmailDeliveryStatus.Sent,
            'emailDelivery.sentAt': sentAt,
            'emailDelivery.lastError': null,
            'emailDelivery.claimToken': null,
            'emailDelivery.leaseExpiresAt': null,
          },
        },
      );
      return { status: 'SENT', recipient, sentAt };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await this.consents.updateOne(
        { _id: consent._id, 'emailDelivery.claimToken': claimToken },
        {
          $set: {
            'emailDelivery.status': ContractEmailDeliveryStatus.Failed,
            'emailDelivery.lastError': message.slice(0, 500),
            'emailDelivery.claimToken': null,
            'emailDelivery.leaseExpiresAt': null,
          },
        },
      );
      this.logger.warn(
        `Signed contract email delivery failed for consent ${consent._id.toString()}: ${message}`,
      );
      return { status: 'FAILED', recipient, sentAt: null };
    }
  }

  private async readBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  private html(filename: string, sha256: string): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#2a2a2a">
        <h2 style="color:#4a0e17">Hợp đồng điện tử đã ký</h2>
        <p>TàGo gửi bạn bản hợp đồng điện tử đã ký. Tệp PDF được đính kèm trong email này.</p>
        <p><strong>Tệp:</strong> ${this.escapeHtml(filename)}</p>
        <p style="font-size:12px;color:#666;word-break:break-all"><strong>SHA-256:</strong> ${sha256}</p>
        <hr style="border:0;border-top:1px solid #e8e2d5;margin:24px 0" />
        <p style="font-size:12px;color:#777">Đây là email giao dịch tự động từ TàGo. Vui lòng lưu tệp để đối chiếu khi cần.</p>
      </div>`;
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return entities[character];
    });
  }
}
