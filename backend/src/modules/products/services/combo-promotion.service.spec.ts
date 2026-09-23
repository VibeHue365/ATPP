import { NotFoundException } from '@nestjs/common';
import { ComboPromotionStatus } from '../schemas/combo-promotion.schema';
import { ComboPromotionService } from './combo-promotion.service';

describe('ComboPromotionService public detail', () => {
  const createService = (result: unknown) => {
    const finalPopulate = jest.fn().mockResolvedValue(result);
    const secondPopulate = jest.fn().mockReturnValue({ populate: finalPopulate });
    const firstPopulate = jest.fn().mockReturnValue({ populate: secondPopulate });
    const findOne = jest.fn().mockReturnValue({ populate: firstPopulate });
    const comboModel = { findOne };
    const service = new ComboPromotionService(comboModel as any, {} as any, {} as any);

    return { service, findOne };
  };

  it('requires ACTIVE status and a current validity window', async () => {
    const combo = { _id: 'combo-public' };
    const { service, findOne } = createService(combo);

    await expect(service.findActivePublicById('combo-public')).resolves.toBe(combo);
    expect(findOne).toHaveBeenCalledWith({
      _id: 'combo-public',
      status: ComboPromotionStatus.Active,
      validFrom: { $lte: expect.any(Date) },
      validTo: { $gte: expect.any(Date) },
    });
  });

  it('hides combos that do not match the public conditions', async () => {
    const { service } = createService(null);

    await expect(service.findActivePublicById('combo-private')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
