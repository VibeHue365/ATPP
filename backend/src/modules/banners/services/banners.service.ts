import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Banner, BannerDocument, BannerPlacement } from '../schemas/banner.schema';
import { UpdateBannerDto } from '../dto/banner.dto';
import { PublicMediaService } from '../../storage/services/public-media.service';

interface CachedBanner {
  data: any;
  cachedAt: number;
}

@Injectable()
export class BannersService {
  private readonly logger = new Logger(BannersService.name);
  private cache = new Map<string, CachedBanner>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút

  constructor(
    @InjectModel(Banner.name)
    private readonly bannerModel: Model<BannerDocument>,
    private readonly publicMediaService: PublicMediaService,
  ) {}

  /**
   * Lấy banner công khai theo placement (O(1) Indexed query, Lean, Cached)
   */
  async getBannerByPlacement(placement: BannerPlacement): Promise<any> {
    const key = `placement_${placement}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.data;
    }

    const banner = await this.bannerModel
      .findOne({ placement, isActive: true })
      .select('placement imageUrl title subtitle linkUrl isActive')
      .lean();

    this.cache.set(key, {
      data: banner || null,
      cachedAt: Date.now(),
    });

    return banner || null;
  }

  /**
   * Lấy tất cả banner đang kích hoạt cho public (Zero N+1)
   */
  async getAllPublicBanners(): Promise<any[]> {
    const key = 'all_public';
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.data;
    }

    const banners = await this.bannerModel
      .find({ isActive: true })
      .select('placement imageUrl title subtitle linkUrl isActive')
      .lean();

    this.cache.set(key, {
      data: banners,
      cachedAt: Date.now(),
    });

    return banners;
  }

  /**
   * Lấy danh sách banner cho Admin Dashboard
   */
  async getAllBannersForAdmin(): Promise<any[]> {
    return this.bannerModel
      .find()
      .populate('updatedBy', 'fullName email')
      .sort({ placement: 1 })
      .lean();
  }

  /**
   * Cập nhật hoặc tạo mới banner (Atomic Upsert + Clean-up ảnh cũ)
   */
  async updateBanner(dto: UpdateBannerDto, adminId?: string): Promise<BannerDocument> {
    // 1. Kiểm tra ảnh cũ để xóa rác Cloudinary nếu ảnh bị thay thế
    const existing = await this.bannerModel.findOne({ placement: dto.placement }).lean();
    if (existing?.imageUrl && existing.imageUrl !== dto.imageUrl) {
      try {
        await this.publicMediaService.deleteByUrl(existing.imageUrl);
        this.logger.log(`Deleted replaced banner image from storage: ${existing.imageUrl}`);
      } catch (err: any) {
        this.logger.warn(`Failed to clean up old banner image ${existing.imageUrl}: ${err?.message}`);
      }
    }

    // 2. Atomic Upsert bằng findOneAndUpdate
    const updated = await this.bannerModel.findOneAndUpdate(
      { placement: dto.placement },
      {
        $set: {
          imageUrl: dto.imageUrl,
          title: dto.title ?? '',
          subtitle: dto.subtitle ?? '',
          linkUrl: dto.linkUrl ?? '',
          isActive: dto.isActive !== undefined ? dto.isActive : true,
          updatedBy: adminId && Types.ObjectId.isValid(adminId) ? new Types.ObjectId(adminId) : null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    // 3. Xóa cache liên quan
    this.clearCache(dto.placement);

    return updated;
  }

  /**
   * Upload ảnh banner lên Cloudinary với kiểm tra Magic Bytes
   */
  async uploadBannerImage(file: Express.Multer.File): Promise<{ url: string; key: string }> {
    return this.publicMediaService.uploadImage('banners', file);
  }

  /**
   * Xóa banner và dọn rác ảnh
   */
  async deleteBanner(placement: BannerPlacement): Promise<{ success: boolean }> {
    const existing = await this.bannerModel.findOne({ placement });
    if (!existing) {
      throw new NotFoundException(`Banner for placement ${placement} not found`);
    }

    if (existing.imageUrl) {
      try {
        await this.publicMediaService.deleteByUrl(existing.imageUrl);
      } catch (err: any) {
        this.logger.warn(`Failed to delete banner image: ${err?.message}`);
      }
    }

    await this.bannerModel.deleteOne({ placement });
    this.clearCache(placement);

    return { success: true };
  }

  private clearCache(placement?: BannerPlacement) {
    if (placement) {
      this.cache.delete(`placement_${placement}`);
    } else {
      this.cache.clear();
    }
    this.cache.delete('all_public');
  }
}
