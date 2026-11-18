import { Readable } from 'node:stream';
import { Types } from 'mongoose';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { ContractSignedEmailService } from './contract-signed-email.service';
import { ContractEmailDeliveryStatus } from './schemas/contract-consent.schema';

describe('ContractSignedEmailService', () => {
  const user: AuthUser = {
    sub: new Types.ObjectId().toString(),
    email: 'Customer@Example.com ',
    sessionId: 'session-1',
    roles: ['CUSTOMER'],
    permissions: [],
  };
  const contractId = new Types.ObjectId().toString();
  const versionId = new Types.ObjectId().toString();
  const consentId = new Types.ObjectId();

  function setup(status: ContractEmailDeliveryStatus) {
    const consent = {
      _id: consentId,
      emailDelivery: { status },
    };
    const consents = {
      findOne: jest.fn().mockResolvedValue(consent),
      findOneAndUpdate: jest.fn().mockResolvedValue({
        ...consent,
        emailDelivery: { status: ContractEmailDeliveryStatus.Sending },
      }),
      findById: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const evidence = {
      getPdfStream: jest.fn().mockResolvedValue({
        stream: Readable.from(Buffer.from('%PDF signed contract')),
        filename: 'VH-HD-001-v1.pdf',
        sha256: 'a'.repeat(64),
      }),
    };
    const mail = { sendMail: jest.fn().mockResolvedValue(true) };
    const service = new ContractSignedEmailService(
      consents as any,
      evidence as any,
      mail as any,
    );
    return { service, consents, evidence, mail };
  }

  it('attaches the official signed PDF and marks the delivery as sent', async () => {
    const { service, consents, evidence, mail } = setup(
      ContractEmailDeliveryStatus.Pending,
    );

    const result = await service.sendAfterAcceptance(
      user,
      contractId,
      versionId,
    );

    expect(result.status).toBe('SENT');
    expect(result.recipient).toBe('customer@example.com');
    expect(evidence.getPdfStream).toHaveBeenCalledWith(
      user,
      contractId,
      versionId,
    );
    expect(mail.sendMail).toHaveBeenCalledWith(
      'customer@example.com',
      expect.stringContaining('VH-HD-001-v1'),
      expect.stringContaining('Hợp đồng điện tử đã ký'),
      expect.stringContaining('SHA-256'),
      [
        expect.objectContaining({
          filename: 'VH-HD-001-v1.pdf',
          contentType: 'application/pdf',
          content: Buffer.from('%PDF signed contract'),
        }),
      ],
    );
    expect(consents.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          'emailDelivery.status': ContractEmailDeliveryStatus.Sent,
        }),
      }),
    );
  });

  it('does not send the email again when the consent was already delivered', async () => {
    const { service, consents, evidence, mail } = setup(
      ContractEmailDeliveryStatus.Sent,
    );
    consents.findOne.mockResolvedValue({
      _id: consentId,
      emailDelivery: {
        status: ContractEmailDeliveryStatus.Sent,
        recipient: 'customer@example.com',
        sentAt: new Date('2026-11-16T01:00:00.000Z'),
      },
    });

    const result = await service.sendAfterAcceptance(
      user,
      contractId,
      versionId,
    );

    expect(result.status).toBe('SENT');
    expect(consents.findOneAndUpdate).not.toHaveBeenCalled();
    expect(evidence.getPdfStream).not.toHaveBeenCalled();
    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('keeps the signed consent successful and records a failed email attempt', async () => {
    const { service, consents, mail } = setup(
      ContractEmailDeliveryStatus.Pending,
    );
    mail.sendMail.mockResolvedValue(false);

    const result = await service.sendAfterAcceptance(
      user,
      contractId,
      versionId,
    );

    expect(result).toEqual({
      status: 'FAILED',
      recipient: 'customer@example.com',
      sentAt: null,
    });
    expect(consents.updateOne).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          'emailDelivery.status': ContractEmailDeliveryStatus.Failed,
          'emailDelivery.lastError': 'MAIL_NOT_CONFIGURED',
        }),
      }),
    );
  });
});
