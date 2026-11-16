import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  HeritageSpot,
  HeritageSpotDocument,
  HeritageSpotSpaceType,
} from '../schemas/heritage-spot.schema';
import { QueryHeritageSpotsDto } from '../dto/query-heritage-spots.dto';
import { HUE_HERITAGE_SPOTS_SEED } from '../data/heritage-spots.seed';

export interface TravelFeeDeltaResult {
  oldTravelFee: number;
  newTravelFee: number;
  rawFeeDelta: number;
  additionalFeeDue: number; // Tuân thủ AD-01: max(rawFeeDelta, 0)
}

@Injectable()
export class HeritageSpotsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(HeritageSpotsService.name);

  constructor(
    @InjectModel(HeritageSpot.name)
    private readonly heritageSpotModel: Model<HeritageSpotDocument>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seedInitialSpots();
  }

  /**
   * Tự động nạp dữ liệu ban đầu 10 di tích Huế nếu collection đang rỗng
   */
  async seedInitialSpots(): Promise<number> {
    try {
      const count = await this.heritageSpotModel.countDocuments();
      if (count === 0) {
        this.logger.log('Seeding initial 10 Hue Heritage Spots...');
        for (const spot of HUE_HERITAGE_SPOTS_SEED) {
          await this.heritageSpotModel.updateOne(
            { slug: spot.slug },
            { $set: spot },
            { upsert: true },
          );
        }
        this.logger.log('Seeded 10 Hue Heritage Spots successfully.');
        return HUE_HERITAGE_SPOTS_SEED.length;
      }
      return count;
    } catch (error) {
      this.logger.error('Failed to seed Hue Heritage Spots', error);
      return 0;
    }
  }

  /**
   * Truy vấn danh sách di tích có lọc theo tọa độ địa không gian $near và điều kiện
   */
  async findAll(dto: QueryHeritageSpotsDto): Promise<HeritageSpot[]> {
    const filter: Record<string, any> = { isActive: true };

    if (dto.spaceType) {
      filter.spaceType = dto.spaceType;
    }

    if (dto.tag) {
      filter.tags = dto.tag;
    }

    if (dto.search && dto.search.trim()) {
      const searchRegex = new RegExp(dto.search.trim(), 'i');
      filter.$or = [{ name: searchRegex }, { address: searchRegex }, { slug: searchRegex }];
    }

    // Nếu có tọa độ lat, lng -> sử dụng chỉ mục 2dsphere $near
    if (
      dto.lat !== undefined &&
      dto.lng !== undefined &&
      Number.isFinite(dto.lat) &&
      Number.isFinite(dto.lng)
    ) {
      const maxDistanceMeters = (dto.radiusKm || 25) * 1000;
      filter.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [dto.lng, dto.lat], // MongoDB GeoJSON thứ tự [lng, lat]
          },
          $maxDistance: maxDistanceMeters,
        },
      };

      return this.heritageSpotModel.find(filter).lean().exec();
    }

    return this.heritageSpotModel.find(filter).sort({ name: 1 }).lean().exec();
  }

  /**
   * Tìm di tích theo ID
   */
  async findById(id: string): Promise<HeritageSpotDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã di tích không hợp lệ.');
    }
    const spot = await this.heritageSpotModel.findById(id).exec();
    if (!spot) {
      throw new NotFoundException(`Không tìm thấy di tích với mã: ${id}`);
    }
    return spot;
  }

  /**
   * Tìm di tích theo slug
   */
  async findBySlug(slug: string): Promise<HeritageSpotDocument> {
    const spot = await this.heritageSpotModel.findOne({ slug, isActive: true }).exec();
    if (!spot) {
      throw new NotFoundException(`Không tìm thấy di tích với slug: ${slug}`);
    }
    return spot;
  }

  /**
   * Tính toán phụ phí di chuyển chênh lệch giữa điểm cũ và điểm mới tuân thủ nghiêm ngặt AD-01
   */
  async calculateTravelFeeDelta(
    oldSpotId?: string | null,
    newSpotId?: string | null,
  ): Promise<TravelFeeDeltaResult> {
    let oldTravelFee = 0;
    let newTravelFee = 0;

    if (oldSpotId && Types.ObjectId.isValid(oldSpotId)) {
      const oldSpot = await this.heritageSpotModel.findById(oldSpotId).select('baseTravelFee').lean();
      if (oldSpot) {
        oldTravelFee = oldSpot.baseTravelFee || 0;
      }
    }

    if (newSpotId && Types.ObjectId.isValid(newSpotId)) {
      const newSpot = await this.heritageSpotModel.findById(newSpotId).select('baseTravelFee').lean();
      if (newSpot) {
        newTravelFee = newSpot.baseTravelFee || 0;
      }
    }

    const rawFeeDelta = newTravelFee - oldTravelFee;
    // AD-01: additionalFeeDue = max(rawFeeDelta, 0), không hoàn tiền mặt hay credit nếu âm
    const additionalFeeDue = Math.max(rawFeeDelta, 0);

    return {
      oldTravelFee,
      newTravelFee,
      rawFeeDelta,
      additionalFeeDue,
    };
  }
}
