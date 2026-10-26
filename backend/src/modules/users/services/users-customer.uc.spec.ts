import {
  BadRequestException,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { UsersRepository } from '../repositories/users.repository';
import { Gender } from '../schemas/user.schema';
import { UsersService } from './users.service';

const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]);
const JPEG_HEADER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0,
]);

describe('Customer profile and wishlist use cases (DaiBLL)', () => {
  const userId = new Types.ObjectId().toString();
  const productId = new Types.ObjectId().toString();

  function createService(user: Record<string, any> | null = { profile: {} }) {
    const usersRepository = {
      findUserById: jest.fn().mockResolvedValue(user),
      isPhoneUsedByAnotherUser: jest.fn().mockResolvedValue(false),
      updateProfile: jest.fn().mockResolvedValue(undefined),
      updatePreferences: jest.fn().mockResolvedValue(undefined),
      toggleFavorite: jest.fn().mockResolvedValue(undefined),
    };
    const userProfileMapper = {
      toMeResponse: jest.fn().mockReturnValue({ id: userId }),
    };
    const publicMedia = {
      uploadImage: jest
        .fn()
        .mockResolvedValue({ url: 'https://cdn.test/avatars/new.png' }),
      deleteByUrl: jest.fn().mockResolvedValue(undefined),
    };
    const service = new UsersService(
      usersRepository as any,
      userProfileMapper as any,
      {} as any,
      publicMedia as any,
    );
    return { service, usersRepository, userProfileMapper, publicMedia };
  }

  function createRepository(user: Record<string, any> | null) {
    const userModel = {
      findById: jest.fn().mockResolvedValue(user),
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    return {
      repository: new UsersRepository(userModel as any, {} as any),
      userModel,
    };
  }

  describe('UC-11 Manage Wishlist', () => {
    it('UT-11 UTCID01 adds a product to the wishlist and returns the refreshed profile', async () => {
      const { service, usersRepository } = createService();

      await expect(
        service.toggleFavorite(userId, 'PRODUCT', productId, ['CUSTOMER']),
      ).resolves.toEqual({ id: userId });

      const [calledUserId, targetType, targetId] =
        usersRepository.toggleFavorite.mock.calls[0];
      expect(calledUserId.toString()).toBe(userId);
      expect(targetType).toBe('PRODUCT');
      expect(targetId.toString()).toBe(productId);
    });

    it('UT-11 UTCID02 removes a favorite that already exists for the same target', async () => {
      const targetId = new Types.ObjectId(productId);
      const { repository, userModel } = createRepository({
        favorites: [{ targetType: 'PRODUCT', targetId }],
      });

      await repository.toggleFavorite(
        new Types.ObjectId(userId),
        'PRODUCT',
        targetId,
      );

      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(Types.ObjectId) },
        { $pull: { favorites: { targetId, targetType: 'PRODUCT' } } },
      );
    });

    it('UT-11 UTCID03 pushes a new favorite with an added timestamp', async () => {
      const { repository, userModel } = createRepository({
        favorites: [{ targetType: 'PRODUCT', targetId: new Types.ObjectId() }],
      });
      const targetId = new Types.ObjectId(productId);

      await repository.toggleFavorite(
        new Types.ObjectId(userId),
        'PRODUCT',
        targetId,
      );

      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(Types.ObjectId) },
        {
          $push: {
            favorites: {
              targetType: 'PRODUCT',
              targetId,
              addedAt: expect.any(Date),
            },
          },
        },
      );
    });

    it('UT-11 UTCID04 treats the same target id with another target type as a new favorite', async () => {
      const targetId = new Types.ObjectId(productId);
      const { repository, userModel } = createRepository({
        favorites: [{ targetType: 'PRODUCT', targetId }],
      });

      await repository.toggleFavorite(
        new Types.ObjectId(userId),
        'PHOTOGRAPHER',
        targetId,
      );

      expect(userModel.updateOne.mock.calls[0][1]).toHaveProperty('$push');
    });

    it('UT-11 UTCID05 creates the first favorite when the wishlist is empty', async () => {
      const { repository, userModel } = createRepository({});
      const targetId = new Types.ObjectId(productId);

      await repository.toggleFavorite(
        new Types.ObjectId(userId),
        'PRODUCT',
        targetId,
      );

      expect(userModel.updateOne).toHaveBeenCalledTimes(1);
      expect(userModel.updateOne.mock.calls[0][1]).toHaveProperty(
        '$push.favorites.targetId',
        targetId,
      );
    });

    it('UT-11 UTCID06 rejects a malformed target id before changing the wishlist', async () => {
      const { service, usersRepository } = createService();

      await expect(
        service.toggleFavorite(userId, 'PRODUCT', 'abc'),
      ).rejects.toThrow(new BadRequestException('Invalid target id'));
      expect(usersRepository.toggleFavorite).not.toHaveBeenCalled();
    });

    it('UT-11 UTCID07 rejects a malformed authenticated user id', async () => {
      const { service, usersRepository } = createService();

      await expect(
        service.toggleFavorite('user-1', 'PRODUCT', productId),
      ).rejects.toThrow(new BadRequestException('Invalid user id'));
      expect(usersRepository.toggleFavorite).not.toHaveBeenCalled();
    });

    it('UT-11 UTCID08 does not write and returns not found when the user no longer exists', async () => {
      const { repository, userModel } = createRepository(null);
      await repository.toggleFavorite(
        new Types.ObjectId(userId),
        'PRODUCT',
        new Types.ObjectId(productId),
      );
      expect(userModel.updateOne).not.toHaveBeenCalled();

      const { service } = createService(null);
      await expect(
        service.toggleFavorite(userId, 'PRODUCT', productId),
      ).rejects.toThrow(new NotFoundException('User not found'));
    });
  });

  describe('UC-13 Update Profile', () => {
    it('UT-13 UTCID01 updates the full name and returns the refreshed profile', async () => {
      const { service, usersRepository } = createService();

      await expect(
        service.updateProfile(userId, { fullName: 'Nguyen Van A' }),
      ).resolves.toEqual({ id: userId });

      expect(usersRepository.updateProfile).toHaveBeenCalledWith(
        expect.any(Types.ObjectId),
        {
          fullName: 'Nguyen Van A',
        },
      );
    });

    it('UT-13 UTCID02 normalizes the phone number before checking uniqueness', async () => {
      const { service, usersRepository } = createService();

      await service.updateProfile(userId, { phone: '0901 234 567' });

      expect(usersRepository.isPhoneUsedByAnotherUser).toHaveBeenCalledWith(
        '0901234567',
        expect.any(Types.ObjectId),
      );
      expect(usersRepository.updateProfile).toHaveBeenCalledWith(
        expect.any(Types.ObjectId),
        {
          phone: '0901 234 567',
          phoneNormalized: '0901234567',
        },
      );
    });

    it('UT-13 UTCID03 rejects a phone number already used by another account', async () => {
      const { service, usersRepository } = createService();
      usersRepository.isPhoneUsedByAnotherUser.mockResolvedValue(true);

      await expect(
        service.updateProfile(userId, { phone: '0901234567' }),
      ).rejects.toThrow(new BadRequestException('Phone already exists'));
      expect(usersRepository.updateProfile).not.toHaveBeenCalled();
    });

    it('UT-13 UTCID04 rejects an update without any profile field', async () => {
      const { service, usersRepository } = createService();

      await expect(service.updateProfile(userId, {})).rejects.toThrow(
        new BadRequestException('No valid profile fields to update'),
      );
      expect(usersRepository.updateProfile).not.toHaveBeenCalled();
    });

    it('UT-13 UTCID05 converts gender and date of birth into stored profile values', async () => {
      const { service, usersRepository } = createService();

      await service.updateProfile(userId, {
        gender: Gender.Female,
        dateOfBirth: '2000-05-20',
      });

      const update = usersRepository.updateProfile.mock.calls[0][1];
      expect(update.gender).toBe(Gender.Female);
      expect(update.dateOfBirth).toEqual(new Date('2000-05-20'));
    });

    it('UT-13 UTCID06 replaces the default address line with the trimmed address', async () => {
      const addresses = [
        { addressLine: 'Old street', isDefault: false },
        { addressLine: 'Default street', isDefault: true },
      ];
      const user = {
        profile: {},
        addresses,
        save: jest.fn().mockResolvedValue(undefined),
      };
      const { service, usersRepository } = createService(user);

      await service.updateProfile(userId, { address: '  12 Le Loi, Hue  ' });

      expect(addresses[1].addressLine).toBe('12 Le Loi, Hue');
      expect(addresses[0].addressLine).toBe('Old street');
      expect(user.save).toHaveBeenCalledTimes(1);
      expect(usersRepository.updateProfile).not.toHaveBeenCalled();
    });

    it('UT-13 UTCID07 creates the first default address when the account has none', async () => {
      const addresses: Array<Record<string, unknown>> = [];
      const user = {
        profile: { fullName: 'Stored Name' },
        auth: { phone: '0900000000' },
        addresses,
        save: jest.fn().mockResolvedValue(undefined),
      };
      const { service } = createService(user);

      await service.updateProfile(userId, { address: '12 Le Loi, Hue' });

      expect(addresses).toEqual([
        {
          label: 'Mặc định',
          recipientName: 'Stored Name',
          phone: '0900000000',
          addressLine: '12 Le Loi, Hue',
          note: null,
          isDefault: true,
        },
      ]);
    });

    it('UT-13 UTCID08 keeps the existing address when the submitted address is blank', async () => {
      const addresses = [{ addressLine: 'Default street', isDefault: true }];
      const user = {
        profile: {},
        addresses,
        save: jest.fn().mockResolvedValue(undefined),
      };
      const { service } = createService(user);

      await service.updateProfile(userId, { address: '   ' });

      expect(addresses[0].addressLine).toBe('Default street');
      expect(addresses).toHaveLength(1);
    });

    it('UT-13 UTCID09 clears the personal note when an empty note is submitted', async () => {
      const addresses: Array<Record<string, unknown>> = [
        { addressLine: 'Default street', note: 'Old note', isDefault: true },
      ];
      const user = {
        profile: {},
        addresses,
        save: jest.fn().mockResolvedValue(undefined),
      };
      const { service, usersRepository } = createService(user);

      await service.updateProfile(userId, { note: '   ' });

      expect(addresses[0].note).toBeNull();
      expect(usersRepository.updatePreferences).toHaveBeenCalledWith(
        expect.any(Types.ObjectId),
        {
          preferences: { note: '' },
        },
      );
    });

    it('UT-13 UTCID10 rejects an avatar request without a file', async () => {
      const { service, publicMedia } = createService();

      await expect(service.updateAvatar(userId, undefined)).rejects.toThrow(
        new BadRequestException('Avatar file is required'),
      );
      expect(publicMedia.uploadImage).not.toHaveBeenCalled();
    });

    it('UT-13 UTCID11 rejects an avatar with an unsupported MIME type', async () => {
      const { service } = createService();
      const file = {
        mimetype: 'image/gif',
        buffer: Buffer.from('GIF89a'),
      } as Express.Multer.File;

      await expect(service.updateAvatar(userId, file)).rejects.toThrow(
        new UnsupportedMediaTypeException(
          'Only jpg, png, and webp images are allowed',
        ),
      );
    });

    it('UT-13 UTCID12 rejects an avatar whose content does not match its MIME type', async () => {
      const { service, publicMedia } = createService();
      const file = {
        mimetype: 'image/png',
        buffer: JPEG_HEADER,
      } as Express.Multer.File;

      await expect(service.updateAvatar(userId, file)).rejects.toThrow(
        new UnsupportedMediaTypeException(
          'Avatar file content is not a supported image',
        ),
      );
      expect(publicMedia.uploadImage).not.toHaveBeenCalled();
    });

    it('UT-13 UTCID13 saves a valid avatar and removes the previous avatar afterwards', async () => {
      const { service, usersRepository, publicMedia } = createService({
        profile: { avatarUrl: 'https://cdn.test/avatars/old.png' },
      });
      const file = {
        mimetype: 'image/png',
        buffer: PNG_HEADER,
      } as Express.Multer.File;

      await expect(service.updateAvatar(userId, file)).resolves.toEqual({
        id: userId,
      });

      expect(usersRepository.updateProfile).toHaveBeenCalledWith(
        expect.any(Types.ObjectId),
        {
          avatarUrl: 'https://cdn.test/avatars/new.png',
        },
      );
      expect(publicMedia.deleteByUrl).toHaveBeenCalledWith(
        'https://cdn.test/avatars/old.png',
      );
      expect(
        usersRepository.updateProfile.mock.invocationCallOrder[0],
      ).toBeLessThan(publicMedia.deleteByUrl.mock.invocationCallOrder[0]);
    });
  });
});
