import { SmartTagAssignmentSchema } from './smart-tag-assignment.schema';
import { SmartTagGenerationRunSchema } from './smart-tag-generation-run.schema';
import { SmartTagTaxonomyMetadataSchema } from './smart-tag-taxonomy-metadata.schema';

describe('smart tag schemas', () => {
  it('defines the generation run idempotency and processing lease indexes', () => {
    expect(SmartTagGenerationRunSchema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { entityType: 1, entityId: 1, inputFingerprint: 1 },
          expect.objectContaining({ unique: true }),
        ],
        [{ status: 1, lockExpiresAt: 1 }, expect.any(Object)],
      ]),
    );
  });

  it('defines current assignment and global taxonomy indexes', () => {
    expect(SmartTagAssignmentSchema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { entityType: 1, entityId: 1, tagCode: 1 },
          expect.objectContaining({ unique: true }),
        ],
        [
          { entityType: 1, entityId: 1, entityRevision: 1, status: 1 },
          expect.any(Object),
        ],
      ]),
    );
    expect(SmartTagTaxonomyMetadataSchema.indexes()).toEqual(
      expect.arrayContaining([
        [{ scope: 1 }, expect.objectContaining({ unique: true })],
      ]),
    );
  });
});
