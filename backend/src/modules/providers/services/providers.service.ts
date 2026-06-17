import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ProvidersRepository } from '../repositories/providers.repository';
import {
  Provider,
  ProviderCapability,
  ProviderStatus,
  ProviderContact,
  ProviderAddress,
  ProviderPolicies,
  ProviderMedia,
} from '../schemas/provider.schema';
import type { ProviderDocument } from '../schemas/provider.schema';
import type { ProviderScheduleDocument } from '../../products/schemas/provider-schedule.schema';

export interface UpdateProviderProfileDto {
  businessName?: string;
  capabilities?: ProviderCapability[];
  contact?: ProviderContact;
  address?: ProviderAddress;
  policies?: ProviderPolicies;
  media?: ProviderMedia;
}

@Injectable()
export class ProvidersService {
  constructor(private readonly providersRepository: ProvidersRepository) {}

  async getOrCreateProvider(
    userIdStr: string,
    userEmail: string,
    userFullName: string,
  ): Promise<ProviderDocument> {
    const userId = this.toObjectId(userIdStr);
    let provider = await this.providersRepository.findByUserId(userId);

    if (!provider) {
      provider = await this.providersRepository.create({
        userId,
        businessName: `${userFullName} Heritage Studio`,
        capabilities: [
          ProviderCapability.AoDaiRental,
          ProviderCapability.Photography,
        ],
        contact: {
          email: userEmail,
          phone: '0901234567',
        },
        address: {
          addressLine: '123 Phố Huế, Quận Hai Bà Trưng',
          city: 'Hà Nội',
          district: 'Hai Bà Trưng',
          ward: 'Phố Huế',
        },
        media: {
          images: ['/hong_lien_hoa.png', '/cuc_hoa_mi.png'],
          logoUrl: '/avatar_hanna.png',
          coverUrl: '/hero_bg.png',
        },
        policies: {
          cancellationPolicy:
            'Hủy lịch trước 24 giờ hoàn cọc 100%. Hủy trễ phạt 50% tiền cọc.',
          rentalPolicy:
            'Thời gian thuê tối đa 3 ngày. Trả trễ hạn phạt 100.000đ/ngày.',
        },
        status: ProviderStatus.Approved,
        rating: { averageRating: 4.8, totalReviews: 12 },
      });
    }

    return provider;
  }

  async updateProfile(
    userIdStr: string,
    dto: UpdateProviderProfileDto,
  ): Promise<ProviderDocument> {
    const userId = this.toObjectId(userIdStr);
    const provider = await this.providersRepository.findByUserId(userId);
    if (!provider) {
      throw new NotFoundException('Provider profile not found');
    }

    const updateData: Partial<Provider> = {};
    if (dto.businessName !== undefined)
      updateData.businessName = dto.businessName;
    if (dto.capabilities !== undefined)
      updateData.capabilities = dto.capabilities;
    if (dto.contact !== undefined) updateData.contact = dto.contact;
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.policies !== undefined) updateData.policies = dto.policies;
    if (dto.media !== undefined) updateData.media = dto.media;

    const updated = await this.providersRepository.update(
      provider._id,
      updateData,
    );
    if (!updated) {
      throw new BadRequestException('Failed to update provider profile');
    }
    return updated;
  }

  async addPortfolioImage(
    userIdStr: string,
    imageUrl: string,
  ): Promise<ProviderDocument> {
    const userId = this.toObjectId(userIdStr);
    const provider = await this.providersRepository.findByUserId(userId);
    if (!provider) {
      throw new NotFoundException('Provider profile not found');
    }

    const updated = await this.providersRepository.addPortfolioImage(
      provider._id,
      imageUrl,
    );
    if (!updated) {
      throw new BadRequestException('Failed to add portfolio image');
    }
    return updated;
  }

  async removePortfolioImage(
    userIdStr: string,
    imageUrl: string,
  ): Promise<ProviderDocument> {
    const userId = this.toObjectId(userIdStr);
    const provider = await this.providersRepository.findByUserId(userId);
    if (!provider) {
      throw new NotFoundException('Provider profile not found');
    }

    const updated = await this.providersRepository.removePortfolioImage(
      provider._id,
      imageUrl,
    );
    if (!updated) {
      throw new BadRequestException('Failed to remove portfolio image');
    }
    return updated;
  }

  // SCHEDULES
  async getSchedules(userIdStr: string): Promise<ProviderScheduleDocument[]> {
    const userId = this.toObjectId(userIdStr);
    const provider = await this.providersRepository.findByUserId(userId);
    if (!provider) {
      throw new NotFoundException('Provider profile not found');
    }

    return this.providersRepository.findSchedulesByProviderId(provider._id);
  }

  async updateRecurringSchedule(
    userIdStr: string,
    dayOfWeek: number,
    workingHours: Array<{ start: string; end: string }>,
  ): Promise<ProviderScheduleDocument> {
    const userId = this.toObjectId(userIdStr);
    const provider = await this.providersRepository.findByUserId(userId);
    if (!provider) {
      throw new NotFoundException('Provider profile not found');
    }

    return this.providersRepository.upsertRecurringSchedule(
      provider._id,
      dayOfWeek,
      workingHours,
    );
  }

  async updateSpecificDateSchedule(
    userIdStr: string,
    dateStr: string,
    isOffDay: boolean,
    customSlots: Array<{ timeSlot: string; status: string }>,
  ): Promise<ProviderScheduleDocument> {
    const userId = this.toObjectId(userIdStr);
    const provider = await this.providersRepository.findByUserId(userId);
    if (!provider) {
      throw new NotFoundException('Provider profile not found');
    }

    const specificDate = new Date(dateStr);
    const offDays = isOffDay ? [specificDate] : [];

    return this.providersRepository.upsertSpecificDateSchedule(
      provider._id,
      specificDate,
      offDays,
      customSlots,
    );
  }

  private toObjectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID');
    }
    return new Types.ObjectId(id);
  }
}
