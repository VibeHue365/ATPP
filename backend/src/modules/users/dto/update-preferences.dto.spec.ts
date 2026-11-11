import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdatePreferencesDto } from './update-preferences.dto';

describe('UpdatePreferencesDto', () => {
  it('accepts explicit body measurements and preference, including null for clearing', async () => {
    for (const sizeInfo of [{ chest: 90, waist: 70, hip: 95, shoulder: 39, bicep: 28, fitPreference: 'REGULAR' }, { chest: null, waist: null, hip: null, shoulder: null, bicep: null, fitPreference: null }]) {
      expect(await validate(plainToInstance(UpdatePreferencesDto, { preferences: { sizeInfo } }))).toHaveLength(0);
    }
  });
  it.each([{ chest: 0 }, { waist: -1 }, { hip: 301 }, { shoulder: 0 }, { bicep: 301 }, { chest: '90' }, { fitPreference: 'AUTO' }])('rejects invalid body measurements %j', async sizeInfo => {
    expect(await validate(plainToInstance(UpdatePreferencesDto, { preferences: { sizeInfo } }))).not.toHaveLength(0);
  });
  it('accepts multiple supported material preferences', async () => {
    const dto = plainToInstance(UpdatePreferencesDto, {
      hasCompletedOnboarding: true,
      preferences: {
        preferredMaterials: ['SILK', 'BROCADE'],
      },
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects unsupported or duplicate material preferences', async () => {
    const unsupported = plainToInstance(UpdatePreferencesDto, {
      preferences: { preferredMaterials: ['COTTON'] },
    });
    const duplicated = plainToInstance(UpdatePreferencesDto, {
      preferences: { preferredMaterials: ['SILK', 'SILK'] },
    });

    expect(await validate(unsupported)).not.toHaveLength(0);
    expect(await validate(duplicated)).not.toHaveLength(0);
  });

  it('accepts address and personal note preferences', async () => {
    const dto = plainToInstance(UpdatePreferencesDto, {
      address: '123 Đường Lê Lợi, Huế',
      preferences: {
        note: 'Ưu tiên gọi điện trước khi giao',
      },
    });

    expect(await validate(dto)).toHaveLength(0);
  });
});
