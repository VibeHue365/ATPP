import { ServiceUnavailableException } from '@nestjs/common';
import { Types } from 'mongoose';
import { OtpService } from './otp.service';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-otp'),
}));

describe('OtpService email queue integration', () => {
  const userId = new Types.ObjectId();
  const tokenId = new Types.ObjectId();

  const createService = (enqueueVerificationOtp: jest.Mock) => {
    const authRepository = {
      createVerificationToken: jest.fn().mockResolvedValue({ _id: tokenId }),
      revokeVerificationToken: jest.fn().mockResolvedValue(undefined),
    };
    const emailQueueService = { enqueueVerificationOtp };
    const service = new OtpService(
      authRepository as never,
      {} as never,
      {} as never,
      emailQueueService as never,
      {} as never,
      {} as never,
    );

    return { service, authRepository, emailQueueService };
  };

  it('enqueues verification email without calling SMTP in the request', async () => {
    const enqueueVerificationOtp = jest.fn().mockResolvedValue('job-1');
    const { service, emailQueueService } = createService(
      enqueueVerificationOtp,
    );

    const otp = await service.createAndSendEmailVerificationOtp(
      userId,
      'customer@example.com',
    );

    expect(otp).toMatch(/^\d{6}$/);
    expect(emailQueueService.enqueueVerificationOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: userId.toString(),
        verificationTokenId: tokenId.toString(),
        email: 'customer@example.com',
        otp,
      }),
    );
  });

  it('revokes the newly created token when enqueue fails', async () => {
    const enqueueVerificationOtp = jest
      .fn()
      .mockRejectedValue(new Error('Redis unavailable'));
    const { service, authRepository } = createService(enqueueVerificationOtp);

    await expect(
      service.createAndSendEmailVerificationOtp(userId, 'customer@example.com'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(authRepository.revokeVerificationToken).toHaveBeenCalledWith(
      tokenId,
    );
  });
});
