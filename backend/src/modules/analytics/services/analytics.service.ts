import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SearchLog } from '../schemas/search-log.schema';
import { ProductViewLog } from '../schemas/product-view-log.schema';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(SearchLog.name) private readonly searchLogModel: Model<SearchLog>,
    @InjectModel(ProductViewLog.name) private readonly productViewLogModel: Model<ProductViewLog>,
  ) {}

  /** Ghi nhận từ khóa tìm kiếm (upsert: +1 mỗi lần gọi) */
  async trackSearch(keyword: string): Promise<void> {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized || normalized.length < 2) return;
    await this.searchLogModel.findOneAndUpdate(
      { keyword: normalized },
      { $inc: { count: 1 }, $set: { lastSearchedAt: new Date() } },
      { upsert: true },
    );
  }

  /** Ghi nhận lượt xem sản phẩm (upsert: +1 mỗi lần gọi) */
  async trackProductView(productId: string): Promise<void> {
    await this.productViewLogModel.findOneAndUpdate(
      { productId: new Types.ObjectId(productId) },
      { $inc: { viewCount: 1 }, $set: { lastViewedAt: new Date() } },
      { upsert: true },
    );
  }

  /** Lấy top N từ khóa tìm kiếm phổ biến */
  async getTopSearches(limit = 10): Promise<{ keyword: string; count: number }[]> {
    const results = await this.searchLogModel
      .find()
      .sort({ count: -1 })
      .limit(limit)
      .select('keyword count')
      .lean();
    return results.map((r) => ({ keyword: r.keyword, count: r.count }));
  }

  /** Lấy viewCount của từng sản phẩm theo danh sách productId */
  async getViewCountMap(productIds: Types.ObjectId[]): Promise<Map<string, number>> {
    const logs = await this.productViewLogModel
      .find({ productId: { $in: productIds } })
      .select('productId viewCount')
      .lean();
    const map = new Map<string, number>();
    for (const log of logs) {
      map.set(log.productId.toString(), log.viewCount);
    }
    return map;
  }
}
