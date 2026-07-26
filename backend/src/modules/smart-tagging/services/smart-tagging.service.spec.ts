import { Types } from 'mongoose';
import {
  SmartTagActorRole,
  SmartTagAssignmentStatus,
  SmartTagEntityType,
  SmartTagGenerationRunStatus,
  SmartTagSourceStatus,
} from '../constants/smart-tag.constants';
import { SmartTaggingService } from './smart-tagging.service';

describe('SmartTaggingService generation run ownership', () => {
  const entityId = new Types.ObjectId();
  const userId = new Types.ObjectId().toString();

  function createService(overrides: Record<string, unknown> = {}) {
    const generationRunModel = {
      create: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      ...overrides,
    };
    const rateLimitService = { assertRateLimit: jest.fn() };
    const service = new SmartTaggingService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      generationRunModel as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      rateLimitService as never,
    );
    return { service, generationRunModel, rateLimitService };
  }

  const input = {
    entityType: SmartTagEntityType.Product,
    entityId,
    entityRevision: 1,
    userId,
    fingerprint: 'same-input',
    taxonomyRevision: 1,
  };

  it('allows exactly one expired processing run to be taken over', async () => {
    const existingRun = {
      _id: new Types.ObjectId(),
      status: SmartTagGenerationRunStatus.Processing,
      lockExpiresAt: new Date(Date.now() - 1000),
    };
    const takeoverRun = { ...existingRun, attemptCount: 2 };
    const { service, generationRunModel } = createService({
      create: jest.fn().mockRejectedValue({ code: 11000 }),
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingRun),
      }),
      findOneAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(takeoverRun),
      }),
    });

    const result = await (service as any).createOrGetRun(input);

    expect(result).toEqual({ run: takeoverRun, created: true });
    expect(generationRunModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: existingRun._id,
        status: SmartTagGenerationRunStatus.Processing,
        lockExpiresAt: expect.objectContaining({ $lte: expect.any(Date) }),
      }),
      expect.objectContaining({
        $inc: { attemptCount: 1 },
        $set: expect.objectContaining({
          status: SmartTagGenerationRunStatus.Processing,
          sourceStatus: {
            rule: SmartTagSourceStatus.Skipped,
            aiText: SmartTagSourceStatus.Skipped,
            aiImage: SmartTagSourceStatus.Skipped,
          },
        }),
      }),
      { new: true },
    );
  });

  it('returns the existing run while its processing lease is still valid', async () => {
    const existingRun = {
      _id: new Types.ObjectId(),
      status: SmartTagGenerationRunStatus.Processing,
      lockExpiresAt: new Date(Date.now() + 30_000),
    };
    const { service, generationRunModel } = createService({
      create: jest.fn().mockRejectedValue({ code: 11000 }),
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingRun),
      }),
      findOneAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    });

    const result = await (service as any).createOrGetRun(input);

    expect(result).toEqual({ run: existingRun, created: false });
    expect(generationRunModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('uses a user-scoped generation rate limit', async () => {
    const { service, rateLimitService } = createService();

    await (service as any).assertGenerationRateLimit(userId);

    expect(rateLimitService.assertRateLimit).toHaveBeenCalledWith(
      `smart-tag:generate:user:${userId}`,
      10,
      60,
    );
  });
  it('carries provider-confirmed active tags into the current revision', async () => {
    const assignmentModel = { updateMany: jest.fn().mockResolvedValue({}) };
    const service = new SmartTaggingService(
      {} as never,
      {} as never,
      {} as never,
      assignmentModel as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.markAssignmentsStale(
      SmartTagEntityType.Product,
      entityId,
      2,
    );

    expect(assignmentModel.updateMany).toHaveBeenNthCalledWith(
      1,
      {
        entityType: SmartTagEntityType.Product,
        entityId,
        entityRevision: { $lt: 2 },
        status: SmartTagAssignmentStatus.Active,
        decidedByRole: SmartTagActorRole.Provider,
      },
      { $set: { entityRevision: 2 } },
    );
    expect(assignmentModel.updateMany).toHaveBeenNthCalledWith(
      2,
      {
        entityType: SmartTagEntityType.Product,
        entityId,
        entityRevision: { $lt: 2 },
        status: { $ne: SmartTagAssignmentStatus.Stale },
      },
      { $set: { status: SmartTagAssignmentStatus.Stale } },
    );
  });
});
