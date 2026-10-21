import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  LandingBanner,
  LandingBannerDocument,
  LandingBannerStatus,
} from './schemas/landing-banner.schema';
import {
  FeaturedLocation,
  FeaturedLocationDocument,
  FeaturedLocationStatus,
} from './schemas/featured-location.schema';

@Injectable()
export class LandingCmsService implements OnModuleInit {
  private readonly logger = new Logger(LandingCmsService.name);

  private cachedBanners: { data: any[]; cachedAt: number } | null = null;
  private cachedLocations: { data: any[]; cachedAt: number } | null = null;
  private readonly CACHE_TTL_MS = 300_000; // 5 phút

  constructor(
    @InjectModel(LandingBanner.name)
    private readonly bannerModel: Model<LandingBannerDocument>,
    @InjectModel(FeaturedLocation.name)
    private readonly locationModel: Model<FeaturedLocationDocument>,
  ) {}

  async onModuleInit() {
    await this.seedBannersIfEmpty();
    await this.seedLocationsIfEmpty();
  }

  async getPublicBanners(): Promise<any[]> {
    if (
      this.cachedBanners &&
      Date.now() - this.cachedBanners.cachedAt < this.CACHE_TTL_MS
    ) {
      return this.cachedBanners.data;
    }

    const banners = await this.bannerModel
      .find({ status: LandingBannerStatus.Active })
      .sort({ displayOrder: 1, createdAt: 1 })
      .select('imageUrl title subtitle linkUrl displayOrder')
      .lean();

    this.cachedBanners = {
      data: banners,
      cachedAt: Date.now(),
    };

    return banners;
  }

  async getPublicLocations(): Promise<any[]> {
    if (
      this.cachedLocations &&
      Date.now() - this.cachedLocations.cachedAt < this.CACHE_TTL_MS
    ) {
      return this.cachedLocations.data;
    }

    const locations = await this.locationModel
      .find({ status: FeaturedLocationStatus.Active })
      .sort({ displayOrder: 1, createdAt: 1 })
      .select('code name description image destination displayOrder')
      .lean();

    this.cachedLocations = {
      data: locations,
      cachedAt: Date.now(),
    };

    return locations;
  }

  /** Xóa cache khi có cập nhật từ CMS admin */
  clearCache() {
    this.cachedBanners = null;
    this.cachedLocations = null;
  }

  private async seedBannersIfEmpty() {
    try {
      const count = await this.bannerModel.countDocuments();
      if (count === 0) {
        this.logger.log('Seeding initial landing banners...');
        await this.bannerModel.insertMany([
          {
            imageUrl: '/images/hero-silk-stone-v2.webp',
            title: 'Hành trình Silk & Stone',
            subtitle: 'Khai phóng vẻ đẹp di sản áo dài truyền thống Việt Nam',
            linkUrl: '#rentals',
            displayOrder: 1,
            status: LandingBannerStatus.Active,
          },
          {
            imageUrl: '/images/hero-gam-moi-v2.webp',
            title: 'Bộ Sưu Tập Gấm Mới',
            subtitle: 'Gấm hoàng gia thêu tay thủ công tinh xảo',
            linkUrl: '#rentals',
            displayOrder: 2,
            status: LandingBannerStatus.Active,
          },
          {
            imageUrl: '/images/hero-hue-heritage-v2.webp',
            title: 'Huế - Heritage Concept',
            subtitle: 'Giảm 15% gói chụp ảnh áo dài ngoại cảnh cổ kính',
            linkUrl: '#photographers',
            displayOrder: 3,
            status: LandingBannerStatus.Active,
          },
        ]);
        this.logger.log('Initial landing banners seeded successfully.');
      }
    } catch (err: any) {
      this.logger.error('Failed to seed landing banners:', err?.message);
    }
  }

  private async seedLocationsIfEmpty() {
    try {
      const count = await this.locationModel.countDocuments();
      if (count === 0) {
        this.logger.log('Seeding initial featured locations...');
        await this.locationModel.insertMany([
          {
            code: 'hue',
            name: 'Huế',
            description: 'Cổ kính và thơ mộng',
            image: '/images/location-hue-v2.webp',
            destination: '/photographers?location=Hu%E1%BA%BF',
            displayOrder: 1,
            status: FeaturedLocationStatus.Active,
          },
          {
            code: 'da-nang',
            name: 'Đà Nẵng',
            description: 'Biển và không gian hiện đại',
            image: '/images/location-da-nang-v2.webp',
            destination: '/photographers?location=%C4%90%C3%A0+N%E1%BA%B5ng',
            displayOrder: 2,
            status: FeaturedLocationStatus.Active,
          },
          {
            code: 'ha-noi',
            name: 'Hà Nội',
            description: 'Phố cổ và nét văn hóa',
            image: '/images/location-ha-noi-v2.webp',
            destination: '/photographers',
            displayOrder: 3,
            status: FeaturedLocationStatus.Active,
          },
        ]);
        this.logger.log('Initial featured locations seeded successfully.');
      }
    } catch (err: any) {
      this.logger.error('Failed to seed featured locations:', err?.message);
    }
  }
}
