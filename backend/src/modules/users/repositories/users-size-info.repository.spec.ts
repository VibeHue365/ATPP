import { Types, model } from 'mongoose';
import { UsersRepository } from './users.repository';
import { UserSchema } from '../schemas/user.schema';

describe('User size info persistence', () => {
  it('updates only explicitly supplied measurements and preserves other preferences', async () => {
    const updateOne = jest.fn().mockResolvedValue({});
    const repository = new UsersRepository({ updateOne } as any, {} as any);
    const userId = new Types.ObjectId();
    await repository.updatePreferences(userId, {
      preferences: {
        sizeInfo: { chest: 90, hip: null, fitPreference: 'COMFORT' },
      },
    });
    expect(updateOne).toHaveBeenCalledWith(
      { _id: userId },
      {
        $set: {
          'preferences.sizeInfo.chest': 90,
          'preferences.sizeInfo.hip': null,
          'preferences.sizeInfo.fitPreference': 'COMFORT',
        },
      },
    );
  });
  it('retains measurements in a hydrated user profile without adding inferred values', () => {
    const UserModel = model('Vib92SchemaTestUser', UserSchema);
    const user = UserModel.hydrate({
      _id: new Types.ObjectId(),
      preferences: {
        sizeInfo: { chest: 90, waist: 70, hip: 95, fitPreference: 'COMFORT' },
      },
    });
    expect(user.toObject().preferences.sizeInfo).toMatchObject({
      chest: 90,
      waist: 70,
      hip: 95,
      fitPreference: 'COMFORT',
    });
    const legacy = UserModel.hydrate({
      _id: new Types.ObjectId(),
      preferences: { sizeInfo: { height: 160, weight: 50 } },
    });
    expect(legacy.preferences.sizeInfo.chest).toBeNull();
    expect(legacy.preferences.sizeInfo.waist).toBeNull();
    expect(legacy.preferences.sizeInfo.hip).toBeNull();
  });
});
