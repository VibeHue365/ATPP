import { RentalEvidenceCleanupService } from './rental-evidence-cleanup.service';

describe('RentalEvidenceCleanupService', () => {
  it('removes expired objects and metadata but preserves evidence for disputed bookings', async () => {
    const uploads = [
      { _id: 'orphan', fileId: 'f1', bookingId: 'b1', bucket: 'private', storageKey: 'orphan.jpg', consumedAt: null },
      { _id: 'disputed', fileId: 'f2', bookingId: 'b2', bucket: 'private', storageKey: 'disputed.jpg', consumedAt: new Date() },
    ];
    const exec = jest.fn().mockResolvedValue(uploads);
    const deleteExec = jest.fn().mockResolvedValue({ deletedCount: 1 });
    const uploadModel = {
      find: jest.fn().mockReturnValue({ limit: () => ({ lean: () => ({ exec }) }) }),
      deleteOne: jest.fn().mockReturnValue({ exec: deleteExec }),
      db: { model: () => ({ exists: jest.fn(({ _id }) => Promise.resolve(_id === 'b2' ? { _id } : null)) }) },
    };
    const storage = { deletePrivateFile: jest.fn().mockResolvedValue(undefined) };
    const service = new RentalEvidenceCleanupService(uploadModel as any, storage as any);

    await expect(service.removeExpiredEvidence(new Date('2026-11-25T00:00:00Z'))).resolves.toBe(1);
    expect(storage.deletePrivateFile).toHaveBeenCalledWith('private', 'orphan.jpg');
    expect(storage.deletePrivateFile).not.toHaveBeenCalledWith('private', 'disputed.jpg');
  });
});
