import { Types } from 'mongoose';
import {
  SmartTagAssignmentStatus,
  SmartTagDefinitionStatus,
  SmartTagEntityType,
} from '../constants/smart-tag.constants';
import { SmartTagPublicProjectionService } from './smart-tag-public-projection.service';

describe('SmartTagPublicProjectionService', () => {
  it('loads active product badges in batch and excludes stale assignments', async () => {
    const firstProductId = new Types.ObjectId();
    const secondProductId = new Types.ObjectId();
    const assignmentFind = jest.fn().mockReturnValue({
      lean: () => ({
        exec: jest.fn().mockResolvedValue([
          {
            entityId: firstProductId,
            entityRevision: 2,
            tagCode: 'TRUYEN_THONG',
          },
          {
            entityId: secondProductId,
            entityRevision: 1,
            tagCode: 'CACH_TAN',
          },
        ]),
      }),
    });
    const definitionFind = jest.fn().mockReturnValue({
      lean: () => ({
        exec: jest.fn().mockResolvedValue([
          {
            code: 'TRUYEN_THONG',
            label: 'Truyền thống',
            description: 'Áo dài truyền thống',
            displayPriority: 10,
            displayConfig: { color: '#111', backgroundColor: '#eee' },
          },
        ]),
      }),
    });
    const service = new SmartTagPublicProjectionService(
      { find: assignmentFind } as any,
      { find: definitionFind } as any,
    );

    const badges = await service.projectProductBadges([
      { _id: firstProductId, taggingRevision: 2 },
      { _id: secondProductId, taggingRevision: 2 },
    ]);

    expect(assignmentFind).toHaveBeenCalledTimes(1);
    expect(assignmentFind).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: SmartTagEntityType.Product,
        entityId: { $in: [firstProductId, secondProductId] },
        status: SmartTagAssignmentStatus.Active,
      }),
    );
    expect(definitionFind).toHaveBeenCalledWith(
      expect.objectContaining({
        code: { $in: ['TRUYEN_THONG'] },
        status: SmartTagDefinitionStatus.Active,
        isPublicBadge: true,
      }),
    );
    expect(badges.get(firstProductId.toString())).toEqual([
      expect.objectContaining({ code: 'TRUYEN_THONG' }),
    ]);
    expect(badges.has(secondProductId.toString())).toBe(false);
  });
});
